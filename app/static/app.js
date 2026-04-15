// ── 常量 ──────────────────────────────────────────────────
const STATUS = {
  pending:   { label: "未开始", color: "#64748B", bg: "#F1F5F9" },
  running:   { label: "进行中", color: "#2563EB", bg: "#EFF6FF" },
  blocked:   { label: "阻塞中", color: "#DC2626", bg: "#FEF2F2" },
  completed: { label: "已完成", color: "#16A34A", bg: "#F0FDF4" },
};
const PRIORITY_LABEL = { 0: "P0", 1: "P1", 2: "P2", 3: "P3" };
const PRIORITY_COLOR = {
  0: { c: "#DC2626", bg: "#FEF2F2" },
  1: { c: "#D97706", bg: "#FFFBEB" },
  2: { c: "#2563EB", bg: "#EFF6FF" },
  3: { c: "#6B7280", bg: "#F9FAFB" },
};
const KB_COLS = ["pending", "running", "blocked", "completed"];

// ── 状态 ──────────────────────────────────────────────────
let projects = [];
let tasks = [];
let currentView = "kanban";
let selectedProject = "all";
let dragTaskId = null;

// ── 初始化 ─────────────────────────────────────────────────
async function init() {
  await loadProjects();
  await loadTasks();
  renderReportCards();
}

// ── Tab 切换 ───────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("tab-tasks").style.display  = tab === "tasks"  ? "" : "none";
  document.getElementById("tab-report").style.display = tab === "report" ? "" : "none";
  document.getElementById("nav-tasks").classList.toggle("active",  tab === "tasks");
  document.getElementById("nav-report").classList.toggle("active", tab === "report");
}

// ── Projects ───────────────────────────────────────────────
async function loadProjects() {
  const resp = await fetch("/api/projects");
  projects = await resp.json();
  renderProjectChips();
}

function renderProjectChips() {
  const container = document.getElementById("project-chips");
  const allChip = `<button class="chip ${selectedProject === "all" ? "active" : ""}" onclick="selectProject('all')">全部</button>`;
  const chips = projects.map(p =>
    `<button class="chip" style="background:${selectedProject === p.id ? p.color : "var(--bg4)"};color:${selectedProject === p.id ? "#fff" : "var(--text3)"}"
      onclick="selectProject('${p.id}')">${p.short || p.name}</button>`
  ).join("");
  container.innerHTML = allChip + chips;
}

function selectProject(pid) {
  selectedProject = pid;
  renderProjectChips();
  loadTasks();
}

function getProjectById(id) {
  return projects.find(p => p.id === id);
}

// ── Tasks ──────────────────────────────────────────────────
async function loadTasks() {
  const params = new URLSearchParams();
  if (selectedProject !== "all") params.set("project", selectedProject);
  const status = document.getElementById("f-status")?.value;
  const priority = document.getElementById("f-priority")?.value;
  const dateFrom = document.getElementById("f-date-from")?.value;
  const dateTo = document.getElementById("f-date-to")?.value;
  if (status)   params.set("status", status);
  if (priority !== "") params.set("priority", priority);
  if (dateFrom) params.set("start_date_from", dateFrom);
  if (dateTo)   params.set("due_date_to", dateTo);

  const resp = await fetch(`/api/tasks?${params}`);
  tasks = await resp.json();
  window._tasks    = tasks;
  window._projects = projects;
  renderTaskView();
}

function setView(v) {
  currentView = v;
  ["kanban","table","gantt"].forEach(name => {
    document.getElementById(`btn-${name}`)?.classList.toggle("active", v === name);
  });
  renderTaskView();
}

function renderTaskView() {
  if (currentView === "kanban")      renderKanban();
  else if (currentView === "table")  renderTable(tasks, projects);
  else                               renderGantt(tasks, projects);
}

// ── Kanban ─────────────────────────────────────────────────
const KB_STATUS_STYLE = {
  pending:   { pillBg: "#F1F5F9", pillColor: "#475569", dot: "○" },
  running:   { pillBg: "#DBEAFE", pillColor: "#1D4ED8", dot: "●" },
  blocked:   { pillBg: "#FEE2E2", pillColor: "#DC2626", dot: "⊘" },
  completed: { pillBg: "#DCFCE7", pillColor: "#15803D", dot: "✓" },
};

function renderKanban() {
  const view = document.getElementById("task-view");
  const byStatus = {};
  KB_COLS.forEach(s => byStatus[s] = []);
  tasks.forEach(t => { if (byStatus[t.status]) byStatus[t.status].push(t); });

  view.innerHTML = `<div class="kanban">${KB_COLS.map(status => {
    const st = STATUS[status];
    const sty = KB_STATUS_STYLE[status];
    const colTasks = byStatus[status];
    return `<div class="kb-col" data-status="${status}"
        ondragover="onColDragOver(event,this)" ondrop="onColDrop(event,'${status}')" ondragleave="this.classList.remove('drag-target')">
      <div class="kb-col-header">
        <span class="kb-status-pill" style="background:${sty.pillBg};color:${sty.pillColor}">${sty.dot} ${st.label}</span>
        <span class="kb-col-count">${colTasks.length}</span>
      </div>
      ${colTasks.map(t => renderKanbanCard(t)).join("")}
    </div>`;
  }).join("")}</div>`;
}

function renderKanbanCard(t) {
  const proj = getProjectById(t.project);
  const pr = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR[1];
  const isDone = t.status === "completed";
  const idLabel = `#${String(t.id).padStart(3, "0")}`;
  const snippet = t.notes ? escHTML(t.notes.slice(0, 60)) + (t.notes.length > 60 ? "…" : "") : "";
  return `<div class="kb-card" draggable="true" data-id="${t.id}"
      ondragstart="onCardDragStart(event,${t.id})"
      ondblclick="openEditModal(${t.id})">
    <div class="kb-card-id">${idLabel}${proj ? ` · ${proj.short || proj.name}` : ""}</div>
    <div class="kb-card-title ${isDone ? "done" : ""}">${escHTML(t.title)}</div>
    ${snippet ? `<div class="kb-card-desc">${snippet}</div>` : ""}
    <div class="kb-card-footer">
      <span class="badge" style="background:${pr.bg};color:${pr.c}">${PRIORITY_LABEL[t.priority] ?? "P?"}</span>
      ${proj ? `<span class="badge" style="background:${proj.color}18;color:${proj.color}">${proj.short || proj.name}</span>` : ""}
      ${t.due_date ? `<span style="font-size:9px;color:var(--text3);margin-left:auto;font-family:'JetBrains Mono',monospace">${t.due_date}</span>` : ""}
    </div>
  </div>`;
}

// ── Drag & Drop ────────────────────────────────────────────
function onCardDragStart(e, id) {
  dragTaskId = id;
  e.dataTransfer.effectAllowed = "move";
}

function onColDragOver(e, col) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  col.classList.add("drag-target");
}

function onColDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-target");
  if (!dragTaskId) return;
  fetch(`/api/tasks/${dragTaskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  }).then(() => { dragTaskId = null; loadTasks(); });
}

// ── Add / Edit Modal ───────────────────────────────────────
function openAddModal() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("modal-slot").innerHTML = `
    <div class="overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">添加任务</div>
        <input class="inp" id="m-title" placeholder="任务标题">
        <div class="form-row">
          <select class="inp" id="m-proj">
            <option value="">无项目</option>
            ${projects.map(p => `<option value="${p.id}">${p.short || p.name}</option>`).join("")}
          </select>
          <select class="inp" id="m-pri">
            ${[0,1,2,3].map(i => `<option value="${i}" ${i===1?"selected":""}>${PRIORITY_LABEL[i]}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <select class="inp" id="m-status">
            ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <input type="date" class="inp" id="m-start" placeholder="开始日期">
          <input type="date" class="inp" id="m-due" value="${today}" placeholder="截止日期">
        </div>
        <textarea class="inp" id="m-notes" placeholder="备注" style="margin-top:8px"></textarea>
        <div class="form-row" style="margin-top:12px">
          <button class="pri-btn" onclick="submitAdd()">添加</button>
          <button class="sec-btn" onclick="closeModal()">取消</button>
        </div>
      </div>
    </div>`;
}

async function submitAdd() {
  const title = document.getElementById("m-title").value.trim();
  if (!title) return;
  await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      project: document.getElementById("m-proj").value || null,
      priority: parseInt(document.getElementById("m-pri").value),
      status: document.getElementById("m-status").value,
      start_date: document.getElementById("m-start").value || null,
      due_date: document.getElementById("m-due").value || null,
      notes: document.getElementById("m-notes").value || null,
    }),
  });
  closeModal(); toast("已添加"); loadTasks();
}

function openEditModal(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById("modal-slot").innerHTML = `
    <div class="overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">编辑任务</div>
        <input class="inp" id="m-title" value="${escHTML(t.title)}">
        <div class="form-row">
          <select class="inp" id="m-proj">
            <option value="">无项目</option>
            ${projects.map(p => `<option value="${p.id}" ${p.id===t.project?"selected":""}>${p.short || p.name}</option>`).join("")}
          </select>
          <select class="inp" id="m-pri">
            ${[0,1,2,3].map(i => `<option value="${i}" ${i===t.priority?"selected":""}>${PRIORITY_LABEL[i]}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <select class="inp" id="m-status">
            ${Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${k===t.status?"selected":""}>${v.label}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <input type="date" class="inp" id="m-start" value="${t.start_date || ""}">
          <input type="date" class="inp" id="m-due" value="${t.due_date || ""}">
        </div>
        <textarea class="inp" id="m-notes" style="margin-top:8px">${escHTML(t.notes || "")}</textarea>
        <div class="form-row" style="margin-top:12px">
          <button class="pri-btn" onclick="submitEdit(${id})">保存</button>
          <button class="act-btn" style="color:#DC2626" onclick="deleteTask(${id})">删除</button>
          <button class="sec-btn" onclick="closeModal()">取消</button>
        </div>
      </div>
    </div>`;
}

async function submitEdit(id) {
  const title = document.getElementById("m-title").value.trim();
  if (!title) return;
  await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      project: document.getElementById("m-proj").value || null,
      priority: parseInt(document.getElementById("m-pri").value),
      status: document.getElementById("m-status").value,
      start_date: document.getElementById("m-start").value || null,
      due_date: document.getElementById("m-due").value || null,
      notes: document.getElementById("m-notes").value || null,
    }),
  });
  closeModal(); toast("已更新"); loadTasks();
}

async function deleteTask(id) {
  if (!confirm("确认删除此任务？")) return;
  await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  closeModal(); toast("已删除"); loadTasks();
}

// ── Report Cards ───────────────────────────────────────────
function renderReportCards() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const monthStr  = todayStr.substring(0, 7);

  document.getElementById("report-cards").innerHTML = [
    { type: "日报", url: "/reports/daily",   label: todayStr },
    { type: "周报", url: "/reports/weekly",  label: `${weekStart.toISOString().split("T")[0]} ~ ${weekEnd.toISOString().split("T")[0]}` },
    { type: "月报", url: "/reports/monthly", label: monthStr },
  ].map(r => `
    <div class="report-card-item" onclick="window.open('${r.url}','_blank')">
      <div class="rc-type">${r.type}</div>
      <div class="rc-title">${r.label}</div>
      <div class="rc-open">点击展开完整报告 →</div>
    </div>`
  ).join("");
}

// ── Helpers ────────────────────────────────────────────────
function escHTML(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Bootstrap ──────────────────────────────────────────────
init();
