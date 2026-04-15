// ── 甘特图渲染 ─────────────────────────────────────────────
// 依赖 app.js 中的全局函数：escHTML(), openEditModal()
// 确保 index.html 中 app.js 在 gantt.js 之前加载
// 由 app.js 中 renderGantt(tasks, projects) 调用

const GANTT_DAY_PX = 36;      // 每天宽度（像素）
const GANTT_ROW_H  = 44;      // 每行高度
const GANTT_LEFT_W = 200;     // 左侧固定列宽

function renderGantt(tasks, projects) {
  const view = document.getElementById("task-view");

  // 确定时间范围：当前周 ±14 天
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - today.getDay() - 7); // 上周一
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeStart.getDate() + 35); // 5 週

  const totalDays = Math.round((rangeEnd - rangeStart) / 86400000);
  const timelineW = totalDays * GANTT_DAY_PX;

  // 过滤有日期的任务（无 due_date 也展示在列表但不渲染条）
  const sorted = [...tasks].sort((a, b) => (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1);

  // 构建日期表头
  const months = [];
  let cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    months.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const pMap = {};
  projects.forEach(p => pMap[p.id] = p);

  const dayHeaders = months.map(d => {
    const isToday = d.toDateString() === today.toDateString();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return `<div style="width:${GANTT_DAY_PX}px;text-align:center;font-size:9px;font-weight:${isToday?"700":"400"};
      color:${isToday?"var(--blue)":isWeekend?"var(--text3)":"var(--text2)"}; flex-shrink:0">
      ${d.getMonth()+1}/${d.getDate()}
    </div>`;
  }).join("");

  const rows = sorted.map(t => {
    const proj = pMap[t.project];
    const projColor = proj ? proj.color : "#8B95A3";
    const prColor = (["#DC2626","#D97706","#2563EB","#6B7280"])[t.priority] || "#6B7280";

    // 计算条的位置
    let barHtml = "";
    if (t.due_date) {
      const due = new Date(t.due_date + "T00:00:00");
      const dueOffset = Math.round((due - rangeStart) / 86400000);

      if (t.start_date) {
        const start = new Date(t.start_date + "T00:00:00");
        const startOffset = Math.round((start - rangeStart) / 86400000);
        const barDays = Math.max(1, Math.round((due - start) / 86400000) + 1);
        barHtml = `<div title="${t.title}" onclick="openEditModal(${t.id})" style="
          position:absolute;left:${startOffset * GANTT_DAY_PX}px;top:10px;
          width:${barDays * GANTT_DAY_PX - 4}px;height:24px;
          background:${projColor};border-radius:4px;cursor:pointer;
          opacity:${t.status==="completed"?0.45:0.85};
          display:flex;align-items:center;padding:0 6px;
          font-size:10px;color:#fff;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
          ${t.title}
        </div>`;
      } else {
        // 菱形标记
        barHtml = `<div title="${t.title} (${t.due_date})" onclick="openEditModal(${t.id})" style="
          position:absolute;left:${dueOffset * GANTT_DAY_PX + GANTT_DAY_PX/2 - 9}px;top:12px;
          width:18px;height:18px;background:${projColor};
          transform:rotate(45deg);cursor:pointer;opacity:${t.status==="completed"?0.4:1}">
        </div>`;
      }
    }

    return `<div style="display:flex;height:${GANTT_ROW_H}px;border-bottom:1px solid var(--border)">
      <!-- 左侧固定信息列 -->
      <div style="width:${GANTT_LEFT_W}px;min-width:${GANTT_LEFT_W}px;padding:0 12px;display:flex;align-items:center;gap:8px;border-right:1px solid var(--border)">
        <div style="width:3px;height:24px;background:${projColor};border-radius:2px;flex-shrink:0"></div>
        <div style="min-width:0">
          <div style="font-size:11px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;${t.status==="completed"?"color:var(--text3);text-decoration:line-through":""}">${escHTML(t.title)}</div>
          <div style="font-size:9px;color:var(--text3);margin-top:2px">${proj ? (proj.short||proj.name) : ""} · <span style="color:${prColor}">P${t.priority}</span></div>
        </div>
      </div>
      <!-- 时间轴 -->
      <div style="position:relative;flex:1;overflow:hidden;height:${GANTT_ROW_H}px">
        ${barHtml}
      </div>
    </div>`;
  }).join("");

  // 今日竖线 offset
  const todayOffset = Math.round((today - rangeStart) / 86400000);
  const todayLineLeft = GANTT_LEFT_W + todayOffset * GANTT_DAY_PX + GANTT_DAY_PX / 2;

  view.innerHTML = `
    <div style="overflow-x:auto;padding:0">
      <div style="min-width:${GANTT_LEFT_W + timelineW}px;position:relative">
        <!-- 今日竖线 -->
        <div style="position:absolute;left:${todayLineLeft}px;top:0;bottom:0;width:1px;background:var(--blue);opacity:.4;z-index:1;pointer-events:none"></div>
        <!-- 表头 -->
        <div style="display:flex;height:32px;border-bottom:2px solid var(--border);background:var(--bg3)">
          <div style="width:${GANTT_LEFT_W}px;min-width:${GANTT_LEFT_W}px;padding:0 12px;display:flex;align-items:center;border-right:1px solid var(--border)">
            <span style="font-size:11px;font-weight:700;color:var(--text2)">任务 (${sorted.length})</span>
          </div>
          <div style="display:flex;align-items:center;overflow:hidden">${dayHeaders}</div>
        </div>
        <!-- 行 -->
        ${rows || `<div class="empty">没有可显示的任务</div>`}
      </div>
    </div>`;
}
