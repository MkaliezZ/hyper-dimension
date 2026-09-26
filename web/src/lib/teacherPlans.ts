type TeacherApi = <T>(
  path: string,
  method?: string,
  body?: object,
) => Promise<T>;

type PlanEntry = {
  plan_ref: string;
  run_ref: string;
  plan: {
    goal: string;
    next_task: string;
    review_date: string;
    weekly_steps: string[];
  };
  status: "draft" | "approved";
  agent_version: string;
  created_at: string;
  approval_reason: string | null;
  approved_at: string | null;
};

function required<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error("Teacher plan element missing: " + selector);
  return element;
}

export function createTeacherPlans(
  root: HTMLElement,
  api: TeacherApi,
): { loadStudentPlans: (studentRef: string) => Promise<void> } {
  const list = required<HTMLUListElement>(root, "#teacher-plans");
  const status = required<HTMLElement>(root, "#teacher-plan-status");
  let selectedStudent = "";

  function message(value: string, error = false): void {
    status.textContent = value;
    status.dataset.error = String(error);
  }

  function line(label: string, value: string): HTMLParagraphElement {
    const item = document.createElement("p");
    item.textContent = label + "：" + value;
    return item;
  }

  function renderPlan(entry: PlanEntry, studentRef: string): HTMLLIElement {
    const row = document.createElement("li");
    const heading = document.createElement("strong");
    heading.textContent =
      (entry.status === "approved" ? "已批准" : "待教师审批") +
      " · " +
      entry.plan.goal;
    row.append(
      heading,
      line("下一项任务", entry.plan.next_task),
      line("复核日期", entry.plan.review_date),
      line("对齐快照", entry.run_ref),
    );
    const weeks = document.createElement("ol");
    for (const step of entry.plan.weekly_steps) {
      const item = document.createElement("li");
      item.textContent = step;
      weeks.append(item);
    }
    row.append(weeks);
    if (entry.status === "approved") {
      row.append(line("批准依据", entry.approval_reason || "未记录"));
      return row;
    }
    const label = document.createElement("label");
    label.textContent = "教师审批依据";
    const reason = document.createElement("textarea");
    reason.rows = 2;
    reason.maxLength = 1000;
    reason.placeholder = "写明已核对的目标、证据与四周任务";
    label.append(reason);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "批准这份计划";
    button.addEventListener("click", async () => {
      const explanation = reason.value.trim();
      if (!explanation) {
        message("请先写明教师审批依据。", true);
        reason.focus();
        return;
      }
      button.disabled = true;
      try {
        await api<{ status: string }>(
          "/api/v1/teacher/students/" +
            encodeURIComponent(studentRef) +
            "/plans/" +
            encodeURIComponent(entry.plan_ref) +
            "/approve",
          "POST",
          { reason: explanation },
        );
        if (selectedStudent !== studentRef) return;
        await loadStudentPlans(studentRef);
        message("计划已批准并记录审计。");
      } catch (error) {
        if (selectedStudent === studentRef) {
          message((error as Error).message, true);
          button.disabled = false;
        }
      }
    });
    row.append(label, button);
    return row;
  }

  async function loadStudentPlans(studentRef: string): Promise<void> {
    selectedStudent = studentRef;
    list.replaceChildren();
    message("正在读取四周计划草稿……");
    try {
      const response = await api<{ plans: PlanEntry[] }>(
        "/api/v1/teacher/students/" + encodeURIComponent(studentRef) + "/plans",
      );
      if (selectedStudent !== studentRef) return;
      if (response.plans.length === 0) {
        const empty = document.createElement("li");
        empty.textContent =
          "暂无计划草稿；先由教师 Agent 根据已确认的对齐建议提交。";
        list.append(empty);
      }
      for (const plan of response.plans) {
        list.append(renderPlan(plan, studentRef));
      }
      message(response.plans.length + " 份计划；草稿需教师核对后批准。");
    } catch (error) {
      if (selectedStudent === studentRef)
        message((error as Error).message, true);
    }
  }

  return { loadStudentPlans };
}
