type TeacherApi = <T>(
  path: string,
  method?: string,
  body?: object,
) => Promise<T>;

type PendingAttempt = {
  attempt_id: string;
  student_id: string;
  created_at: string;
};

type ReportSummary = {
  report_ref: string;
  attempt_ref: string;
  score: number;
  summary: string;
  created_at: string;
};

type ReportDetail = {
  score: number;
  breakdown: Record<string, number>;
  summary: string;
  strengths: string[];
  needs_work: string[];
  next_steps: string[];
  teacher_policy_ref: string;
  note: string;
};

function required<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error("Teacher report element missing: " + selector);
  return element;
}

export function createTeacherReports(
  root: HTMLElement,
  api: TeacherApi,
  classRef: () => string,
  rosterNames: () => Map<string, string>,
): {
  loadPending: () => Promise<void>;
  loadStudentReports: (studentRef: string) => Promise<void>;
} {
  const pending = required<HTMLUListElement>(root, "#pending-attempts");
  const pendingStatus = required<HTMLElement>(root, "#pending-status");
  const reports = required<HTMLUListElement>(root, "#teacher-reports");
  const reportStatus = required<HTMLElement>(root, "#teacher-report-status");
  const detail = required<HTMLElement>(root, "#teacher-report-detail");
  let selectedStudent = "";

  function message(target: HTMLElement, value: string, error = false): void {
    target.textContent = value;
    target.dataset.error = String(error);
  }

  async function loadPending(): Promise<void> {
    const requestedClass = classRef();
    if (!requestedClass) return;
    pending.replaceChildren();
    message(pendingStatus, "正在读取待批改引用……");
    try {
      const response = await api<{ attempts: PendingAttempt[] }>(
        "/api/v1/teacher/classes/" +
          encodeURIComponent(requestedClass) +
          "/pending-attempts",
      );
      if (classRef() !== requestedClass) return;
      if (response.attempts.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "当前没有待批改答卷。";
        pending.append(empty);
      }
      for (const attempt of response.attempts) {
        const row = document.createElement("li");
        row.textContent =
          (rosterNames().get(attempt.student_id) || attempt.student_id) +
          " · " +
          attempt.attempt_id +
          " · " +
          new Date(attempt.created_at).toLocaleString("zh-CN");
        pending.append(row);
      }
      message(
        pendingStatus,
        response.attempts.length + " 份待批改；请由教师 Agent 通过 MCP 处理。",
      );
    } catch (error) {
      if (classRef() !== requestedClass) return;
      message(pendingStatus, (error as Error).message, true);
    }
  }

  function renderDetail(value: ReportDetail): void {
    detail.replaceChildren();
    const add = (label: string, text: string) => {
      const line = document.createElement("p");
      line.textContent = label + "：" + text;
      detail.append(line);
    };
    add("总分", String(value.score));
    add(
      "维度",
      Object.entries(value.breakdown)
        .map(([key, score]) => key + " " + score)
        .join(" · "),
    );
    add("诊断", value.summary);
    add("优势", value.strengths.join("；") || "暂无");
    add("需加强", value.needs_work.join("；") || "暂无");
    add("下一步", value.next_steps.join("；") || "暂无");
    add("批准策略", value.teacher_policy_ref);
    add("说明", value.note);
    detail.hidden = false;
  }

  async function loadStudentReports(studentRef: string): Promise<void> {
    selectedStudent = studentRef;
    reports.replaceChildren();
    detail.hidden = true;
    message(reportStatus, "正在读取已批准报告……");
    try {
      const response = await api<{ reports: ReportSummary[] }>(
        "/api/v1/teacher/students/" +
          encodeURIComponent(studentRef) +
          "/reports",
      );
      if (selectedStudent !== studentRef) return;
      if (response.reports.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "该学生尚无已批准报告。";
        reports.append(empty);
      }
      for (const summary of response.reports) {
        const row = document.createElement("li");
        const label = document.createElement("span");
        label.textContent =
          summary.score +
          " 分 · " +
          summary.summary +
          " · " +
          new Date(summary.created_at).toLocaleDateString("zh-CN");
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "查看报告";
        open.addEventListener("click", async () => {
          try {
            const value = await api<ReportDetail>(
              "/api/v1/teacher/students/" +
                encodeURIComponent(studentRef) +
                "/reports/" +
                encodeURIComponent(summary.report_ref),
            );
            if (selectedStudent !== studentRef) return;
            renderDetail(value);
            message(
              reportStatus,
              "已读取批准报告 " + summary.report_ref + "。",
            );
          } catch (error) {
            if (selectedStudent === studentRef) {
              message(reportStatus, (error as Error).message, true);
            }
          }
        });
        row.append(label, open);
        reports.append(row);
      }
      message(reportStatus, response.reports.length + " 份已批准报告。");
    } catch (error) {
      if (selectedStudent !== studentRef) return;
      message(reportStatus, (error as Error).message, true);
    }
  }

  required<HTMLButtonElement>(root, "#pending-refresh").addEventListener(
    "click",
    () => void loadPending(),
  );
  return { loadPending, loadStudentReports };
}
