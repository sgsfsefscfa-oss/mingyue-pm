// ── 表格视图渲染 ────────────────────────────────────────────
// 由 app.js 中 renderTable(tasks, projects) 调用

let tableSortKey = "priority";
let tableSortAsc = true;

function renderTable(tasks, projects) {
  const view = document.getElementById("task-view");
  const pMap = {};
  projects.forEach(p => pMap[p.id] = p);

  // 排序
  const sorted = [...tasks].sort((a, b) => {
    let av = a[tableSortKey] ?? "";
    let bv = b[tableSortKey] ?? "";
    if (tableSortKey === "priority") { av = Number(av); bv = Number(bv); }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return tableSortAsc ? cmp : -cmp;
  });

  const cols = [
    { key: "priority", label: "优先级", width: "70px" },
    { key: "title",    label: "标题",   width: "auto" },
    { key: "project",  label: "项目",   width: "100px" },
    { key: "status",   label: "状态",   width: "90px" },
    { key: "due_date", label: "截止日期", width: "110px" },
    { key: "notes",    label: "备注",   width: "200px" },
  ];

  const sortIcon = (key) => {
    if (key !== tableSortKey) return `<span style="color:var(--text3);font-size:9px">↕</span>`;
    return `<span style="color:var(--blue);font-size:9px">${tableSortAsc ? "↑" : "↓"}</span>`;
  };

  const thead = `<thead><tr style="background:var(--bg3)">
    ${cols.map(c => `<th style="width:${c.width};padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text2);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap;user-select:none"
      onclick="tableSort('${c.key}')">${c.label} ${sortIcon(c.key)}</th>`).join("")}
  </tr></thead>`;

  const tbody = `<tbody>${sorted.map(t => {
    const proj = pMap[t.project];
    const pr = { 0:["#DC2626","#FEF2F2"], 1:["#D97706","#FFFBEB"], 2:["#2563EB","#EFF6FF"], 3:["#6B7280","#F9FAFB"] }[t.priority] || ["#6B7280","#F9FAFB"];
    const st = { pending:["#475569","#F1F5F9"], running:["#1D4ED8","#DBEAFE"], blocked:["#DC2626","#FEE2E2"], completed:["#15803D","#DCFCE7"] }[t.status] || ["#6B7280","#F1F5F9"];
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="openEditModal(${t.id})"
        onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''">
      <td style="padding:10px 12px">
        <span class="badge" style="background:${pr[1]};color:${pr[0]}">P${t.priority}</span>
      </td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:var(--text);${t.status==="completed"?"text-decoration:line-through;color:var(--text3)":""}">${escHTML(t.title)}</td>
      <td style="padding:10px 12px">
        ${proj ? `<span class="badge" style="background:${proj.color}18;color:${proj.color}">${proj.short||proj.name}</span>` : "—"}
      </td>
      <td style="padding:10px 12px">
        <span class="badge" style="background:${st[1]};color:${st[0]}">${{pending:"未开始",running:"进行中",blocked:"阻塞中",completed:"已完成"}[t.status]}</span>
      </td>
      <td style="padding:10px 12px;font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${t.due_date || "—"}</td>
      <td style="padding:10px 12px;font-size:11px;color:var(--text3);max-width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHTML(t.notes || "")}</td>
    </tr>`;
  }).join("")}</tbody>`;

  view.innerHTML = `<div style="padding:16px 24px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;background:var(--bg2);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)">
      ${thead}${tbody}
    </table>
    ${sorted.length === 0 ? `<div class="empty" style="margin-top:40px">没有匹配的任务</div>` : ""}
  </div>`;
}

function tableSort(key) {
  if (tableSortKey === key) tableSortAsc = !tableSortAsc;
  else { tableSortKey = key; tableSortAsc = true; }
  // 触发重渲染（app.js 已加载 tasks 和 projects）
  renderTable(window._tasks || [], window._projects || []);
}
