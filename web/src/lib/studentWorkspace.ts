type Question = {
  id: string;
  kind: "mcq" | "writing";
  prompt: string;
  options?: string[];
};

type StudentResult = {
  reports: {
    report_ref: string;
    created_at: string;
    report: {
      score: number;
      breakdown: Record<string, number>;
      summary: string;
      strengths: string[];
      needs_work: string[];
      next_steps: string[];
      wrong_answers: string[];
      note: string;
    };
  }[];
  plans: {
    plan_ref: string;
    approved_at: string;
    plan: {
      goal: string;
      next_task: string;
      review_date: string;
      weekly_steps: string[];
    };
  }[];
  audit_event_id: string;
};

type Assignment = {
  bundle_id: string;
  questions: Question[];
  book_id: string;
  school_progress: string;
  audit_event_id: string;
};

function required<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element)
    throw new Error("Student workspace element missing: " + selector);
  return element;
}

export function initStudentWorkspace(): void {
  const root = document.getElementById("student-workspace");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";
  const workspace = root;
  const access = required<HTMLElement>(workspace, "#student-access");
  const panel = required<HTMLElement>(workspace, "#student-questions-panel");
  const questions = required<HTMLElement>(workspace, "#student-questions");
  const status = required<HTMLElement>(workspace, "#student-status");
  const result = required<HTMLElement>(workspace, "#student-result");
  const progressAccess = required<HTMLElement>(
    workspace,
    "#student-progress-access",
  );
  const progressPanel = required<HTMLElement>(
    workspace,
    "#student-progress-panel",
  );
  const progressStatus = required<HTMLElement>(
    workspace,
    "#student-progress-status",
  );
  const progressReports = required<HTMLUListElement>(
    workspace,
    "#student-progress-reports",
  );
  const progressPlans = required<HTMLUListElement>(
    workspace,
    "#student-progress-plans",
  );
  let progressSequence = 0;
  const submitButton = required<HTMLButtonElement>(
    workspace,
    "#student-submit",
  );
  let assignment: Assignment | null = null;
  let accessCode = "";
  let signedName = "";
  let lastAnswers = "";
  let attemptRef = "";
  let idempotencyKey = "";

  function message(target: HTMLElement, value: string, error = false): void {
    target.textContent = value;
    target.dataset.error = String(error);
  }

  async function post<T>(path: string, body: object): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 422
          ? "身份或提交内容未通过校验，请核对后重试。"
          : "本地任务 API 请求失败（HTTP " + response.status + "）。",
      );
    }
    return response.json() as Promise<T>;
  }

  function renderQuestions(bundle: Assignment): void {
    questions.replaceChildren();
    for (const [index, question] of bundle.questions.entries()) {
      const number = index + 1 + ". ";
      if (question.kind === "mcq" && question.options) {
        const fieldset = document.createElement("fieldset");
        fieldset.dataset.questionId = question.id;
        const legend = document.createElement("legend");
        legend.textContent = number + question.prompt;
        fieldset.append(legend);
        for (const option of question.options) {
          const label = document.createElement("label");
          label.className = "option";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "question-" + index;
          input.value = option;
          const description = document.createElement("span");
          description.textContent = option;
          label.append(input, description);
          fieldset.append(label);
        }
        questions.append(fieldset);
      } else if (question.kind === "writing") {
        const section = document.createElement("div");
        section.className = "writing-item";
        section.dataset.questionId = question.id;
        const label = document.createElement("label");
        label.textContent = number + question.prompt;
        const area = document.createElement("textarea");
        area.rows = 7;
        area.maxLength = 6000;
        label.append(area);
        section.append(label);
        questions.append(section);
      }
    }
    required<HTMLElement>(workspace, "#student-question-count").textContent =
      bundle.questions.length + " 题";
    required<HTMLElement>(workspace, "#student-assignment-meta").textContent =
      "教材 " +
      bundle.book_id +
      " · 学校进度 " +
      (bundle.school_progress || "未记录") +
      " · 题包 " +
      bundle.bundle_id;
    panel.hidden = false;
    submitButton.disabled = false;
    message(result, "请完成全部题目后提交。");
  }

  async function openAssignment(): Promise<void> {
    const bundleRef = required<HTMLInputElement>(
      workspace,
      "#student-bundle-ref",
    ).value.trim();
    const name = required<HTMLInputElement>(
      workspace,
      "#student-signed-name",
    ).value.trim();
    const codeInput = required<HTMLInputElement>(
      workspace,
      "#student-access-code",
    );
    const code = codeInput.value.trim();
    codeInput.value = "";
    panel.hidden = true;
    assignment = null;
    accessCode = "";
    signedName = "";
    if (!bundleRef || !name || !code) {
      message(status, "请填写题包编号、签写姓名和个人访问码。", true);
      return;
    }
    try {
      const loaded = await post<Assignment>(
        "/api/v1/student/assignments/lookup",
        { bundle_ref: bundleRef, signed_name: name, access_code: code },
      );
      assignment = loaded;
      accessCode = code;
      signedName = name;
      required<HTMLInputElement>(workspace, "#student-signed-name").value = "";
      lastAnswers = "";
      attemptRef = "";
      idempotencyKey = "";
      renderQuestions(loaded);
      message(status, "题包已读取。打开记录已写入审计。");
    } catch (error) {
      message(status, (error as Error).message, true);
    }
  }

  function collectAnswers(bundle: Assignment): Record<string, string> {
    const answers: Record<string, string> = {};
    const rows = [...questions.children] as HTMLElement[];
    for (const [index, question] of bundle.questions.entries()) {
      const row = rows[index];
      if (!row || row.dataset.questionId !== question.id) {
        throw new Error("题目与答卷位置不一致，请重新领取任务。");
      }
      const answer =
        question.kind === "mcq"
          ? row.querySelector<HTMLInputElement>('input[type="radio"]:checked')
              ?.value
          : row.querySelector<HTMLTextAreaElement>("textarea")?.value.trim();
      if (!answer) throw new Error("请先完成第 " + (index + 1) + " 题。");
      answers[question.id] = answer;
    }
    return answers;
  }

  async function submitAnswers(): Promise<void> {
    const current = assignment;
    if (!current || !accessCode || !signedName) {
      message(result, "请先重新领取任务。", true);
      return;
    }
    try {
      const answers = collectAnswers(current);
      const serialized = JSON.stringify(answers);
      if (serialized !== lastAnswers) {
        attemptRef = "attempt-" + crypto.randomUUID();
        idempotencyKey = "submit-" + crypto.randomUUID();
        lastAnswers = serialized;
      }
      submitButton.disabled = true;
      const response = await post<{ status: string; attempt_id: string }>(
        "/api/v1/student/attempts",
        {
          access_code: accessCode,
          signed_name: signedName,
          bundle_ref: current.bundle_id,
          attempt_ref: attemptRef,
          idempotency_key: idempotencyKey,
          answers,
        },
      );
      message(
        result,
        response.status === "submitted"
          ? "答卷已提交，等待教师 Agent 批改。提交编号：" + response.attempt_id
          : "答卷已处理。请由老师确认报告。提交编号：" + response.attempt_id,
      );
      accessCode = "";
      signedName = "";
      questions
        .querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >("input, textarea")
        .forEach((field) => {
          field.disabled = true;
        });
    } catch (error) {
      submitButton.disabled = false;
      message(result, (error as Error).message, true);
    }
  }

  function resultLine(label: string, value: string): HTMLParagraphElement {
    const line = document.createElement("p");
    line.textContent = label + "：" + value;
    return line;
  }

  function renderProgress(value: StudentResult): void {
    progressReports.replaceChildren();
    progressPlans.replaceChildren();
    if (value.reports.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "暂无已批准报告。";
      progressReports.append(empty);
    }
    for (const item of value.reports) {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent =
        item.report.score +
        " 分 · " +
        new Date(item.created_at).toLocaleDateString("zh-CN");
      row.append(
        title,
        resultLine("诊断", item.report.summary),
        resultLine("优势", item.report.strengths.join("；")),
        resultLine("需加强", item.report.needs_work.join("；")),
        resultLine("下一步", item.report.next_steps.join("；")),
        resultLine(
          "维度",
          Object.entries(item.report.breakdown)
            .map(([name, score]) => name + " " + score)
            .join(" · "),
        ),
        resultLine("说明", item.report.note),
      );
      progressReports.append(row);
    }
    if (value.plans.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "暂无教师已批准的个人计划。";
      progressPlans.append(empty);
    }
    for (const item of value.plans) {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.plan.goal;
      row.append(
        title,
        resultLine("下一项任务", item.plan.next_task),
        resultLine("复核日期", item.plan.review_date),
      );
      const weeks = document.createElement("ol");
      for (const step of item.plan.weekly_steps) {
        const line = document.createElement("li");
        line.textContent = step;
        weeks.append(line);
      }
      row.append(weeks);
      progressPlans.append(row);
    }
    progressPanel.hidden = false;
  }

  async function openProgress(): Promise<void> {
    const sequence = ++progressSequence;
    const name = required<HTMLInputElement>(
      workspace,
      "#student-progress-name",
    );
    const code = required<HTMLInputElement>(
      workspace,
      "#student-progress-code",
    );
    const signedName = name.value.trim();
    const accessCode = code.value.trim();
    name.value = "";
    code.value = "";
    progressPanel.hidden = true;
    progressReports.replaceChildren();
    progressPlans.replaceChildren();
    if (!signedName || !accessCode) {
      message(progressStatus, "请签写姓名并填写个人访问码。", true);
      return;
    }
    message(progressStatus, "正在读取本人已批准结果……");
    try {
      const data = await post<StudentResult>("/api/v1/student/results/lookup", {
        signed_name: signedName,
        access_code: accessCode,
      });
      if (sequence !== progressSequence) return;
      renderProgress(data);
      message(progressStatus, "已读取本人结果，并记录访问审计。");
    } catch (error) {
      if (sequence === progressSequence) {
        message(progressStatus, (error as Error).message, true);
      }
    }
  }

  required<HTMLButtonElement>(progressAccess, "button").addEventListener(
    "click",
    () => void openProgress(),
  );
  progressAccess.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void openProgress();
    }
  });

  required<HTMLButtonElement>(access, "button").addEventListener(
    "click",
    () => void openAssignment(),
  );
  access.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void openAssignment();
    }
  });
  submitButton.addEventListener("click", () => void submitAnswers());
}
