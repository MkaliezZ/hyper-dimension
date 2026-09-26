import { createTeacherReports } from "./teacherReports";
import { createTeacherPlans } from "./teacherPlans";

type StudentSummary = {
  student_ref: string;
  display_name: string;
  public_alias: string;
  age: number;
  grade: number;
  book_id: string;
  school_progress: string;
  version: number;
};

type StudentProfile = Omit<StudentSummary, "student_ref"> & {
  student_id: string;
  class_id: string;
  teacher_notes: string;
  learning_goals: string;
};

type Milestone = {
  milestone_id: string;
  capability_node: string;
  target_date: string;
  version: number;
};

type AlignmentRunSummary = {
  run_ref: string;
  milestone_ref: string;
  milestone_version: number;
  recommendation_count: number;
  created_at: string;
};

type Recommendation = {
  student_ref: string;
  group: string;
  reason: string;
  evidence_refs: string[];
};

type AlignmentDecision = {
  student_ref: string;
  decision: string;
  override_group: string | null;
  reason: string;
};

type AlignmentRun = {
  run_ref: string;
  milestone_ref: string;
  rule_version: string;
  recommendations: Recommendation[];
  decisions: AlignmentDecision[];
};

type AlignmentEvidence = {
  evidence_id: string;
  report_id: string;
  capability_node: string;
  construct_ref: string;
  score_dimension: string;
  difficulty: number;
  prompt_strength: number;
  score: number;
  status: string;
};

type ArchiveArtifact = {
  artifact_id: string;
  kind: string;
  source_ref: string;
  export_state: string;
};

function required<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element)
    throw new Error("Teacher dashboard element missing: " + selector);
  return element;
}

export function initTeacherDashboard(): void {
  const root = document.getElementById("teacher-dashboard");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";
  const dashboard = root;

  const connect = required<HTMLElement>(root, "#teacher-connect");
  const profileForm = required<HTMLElement>(root, "#teacher-profile");
  const status = required<HTMLElement>(dashboard, "#teacher-status");
  const workspace = required<HTMLElement>(dashboard, "#teacher-workspace");
  const roster = required<HTMLUListElement>(root, "#teacher-roster");
  const studentPanel = required<HTMLElement>(dashboard, "#student-panel");
  const artifacts = required<HTMLUListElement>(root, "#teacher-artifacts");
  const alignmentMilestone = required<HTMLSelectElement>(
    dashboard,
    "#alignment-milestone",
  );
  const alignmentRun = required<HTMLSelectElement>(dashboard, "#alignment-run");
  const alignmentStatus = required<HTMLElement>(dashboard, "#alignment-status");
  const alignmentRecommendations = required<HTMLUListElement>(
    dashboard,
    "#alignment-recommendations",
  );
  let token = "";
  let classRef = "";
  let studentRef = "";
  let version = 0;
  let studentLoadSequence = 0;
  let milestones: Milestone[] = [];
  let runs: AlignmentRunSummary[] = [];
  let rosterNames = new Map<string, string>();
  let alignmentLoadSequence = 0;

  function message(value: string, error = false): void {
    status.textContent = value;
    status.dataset.error = String(error);
  }

  async function api<T>(
    path: string,
    method = "GET",
    body?: object,
  ): Promise<T> {
    if (!token) throw new Error("请先连接本地教师 API。");
    const response = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "omit",
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const explanations: Record<number, string> = {
        401: "演示令牌无效或已过期。",
        403: "当前教师无权访问该资料。",
        409: "档案版本冲突或输入不符合规则，请重新打开学生档案。",
        422: "输入格式不符合 API 要求。",
      };
      throw new Error(
        explanations[response.status] ||
          "请求失败（HTTP " + response.status + "），请检查本地 API。",
      );
    }
    return response.json() as Promise<T>;
  }

  const teacherReports = createTeacherReports(
    dashboard,
    api,
    () => classRef,
    () => rosterNames,
  );
  const teacherPlans = createTeacherPlans(dashboard, api);

  const decisionLabels: Record<string, string> = {
    confirm: "确认",
    override: "调整",
    reject: "驳回",
  };

  const reasonLabels: Record<string, string> = {
    prerequisite_evidence_insufficient: "前置能力缺少两次可比测评",
    prerequisite_below_threshold: "前置能力低于支撑阈值",
    two_recent_independent_target_successes: "两次独立完成目标任务",
    target_evidence_needs_practice: "目标任务仍需练习",
    target_evidence_insufficient: "目标能力缺少可比测评",
  };

  function alignmentMessage(value: string, error = false): void {
    alignmentStatus.textContent = value;
    alignmentStatus.dataset.error = String(error);
  }

  async function showEvidence(
    ref: string,
    evidenceRefs: string[],
    output: HTMLElement,
  ): Promise<void> {
    try {
      const result = await api<{ evidence: AlignmentEvidence[] }>(
        "/api/v1/teacher/students/" +
          encodeURIComponent(ref) +
          "/alignment-evidence",
      );
      const selected = result.evidence.filter((item) =>
        evidenceRefs.includes(item.evidence_id),
      );
      output.replaceChildren();
      if (selected.length === 0) {
        output.textContent = "快照没有可展示的对应证据；请勿据此提升分组。";
        return;
      }
      for (const item of selected) {
        const line = document.createElement("p");
        line.textContent =
          item.capability_node +
          " · 构念 " +
          item.construct_ref +
          " · " +
          item.score_dimension +
          " " +
          item.score +
          " 分 · 难度 " +
          item.difficulty +
          " · 提示 " +
          item.prompt_strength +
          " · " +
          item.status +
          " · 报告 " +
          item.report_id;
        output.append(line);
      }
    } catch (error) {
      output.textContent = (error as Error).message;
    }
  }

  function renderAlignmentRun(run: AlignmentRun): void {
    alignmentRecommendations.replaceChildren();
    const decisions = new Map(
      run.decisions.map((item) => [item.student_ref, item]),
    );
    for (const recommendation of run.recommendations) {
      const item = document.createElement("li");
      const title = document.createElement("h3");
      title.textContent =
        rosterNames.get(recommendation.student_ref) ||
        recommendation.student_ref;
      const group = document.createElement("p");
      group.textContent =
        "建议：" +
        recommendation.group +
        " · " +
        (reasonLabels[recommendation.reason] || recommendation.reason);
      const evidence = document.createElement("div");
      evidence.className = "alignment-evidence";
      if (recommendation.evidence_refs.length) {
        const inspect = document.createElement("button");
        inspect.type = "button";
        inspect.textContent =
          "查看依据（" + recommendation.evidence_refs.length + "）";
        inspect.addEventListener(
          "click",
          () =>
            void showEvidence(
              recommendation.student_ref,
              recommendation.evidence_refs,
              evidence,
            ),
        );
        item.append(title, group, inspect, evidence);
      } else {
        evidence.textContent = "没有可比证据。";
        item.append(title, group, evidence);
      }
      const prior = decisions.get(recommendation.student_ref);
      if (prior) {
        const fixed = document.createElement("p");
        fixed.textContent =
          "教师决定：" +
          (decisionLabels[prior.decision] || prior.decision) +
          (prior.override_group ? " → " + prior.override_group : "") +
          " · 原因：" +
          prior.reason;
        item.append(fixed);
      } else {
        const controls = document.createElement("div");
        controls.className = "alignment-decision";
        const actionLabel = document.createElement("label");
        actionLabel.textContent = "决定";
        const action = document.createElement("select");
        for (const [value, label] of [
          ["confirm", "确认建议"],
          ["override", "调整分组"],
          ["reject", "驳回建议"],
        ])
          action.add(new Option(label, value));
        actionLabel.append(action);
        const groupLabel = document.createElement("label");
        groupLabel.textContent = "调整后分组";
        const overrideGroup = document.createElement("select");
        for (const value of ["前置支撑", "核心练习", "迁移挑战", "待补证"]) {
          overrideGroup.add(new Option(value, value));
        }
        groupLabel.append(overrideGroup);
        groupLabel.hidden = true;
        action.addEventListener("change", () => {
          groupLabel.hidden = action.value !== "override";
        });
        const reasonLabel = document.createElement("label");
        reasonLabel.textContent = "确认依据或调整原因";
        const reason = document.createElement("input");
        reason.maxLength = 1000;
        reasonLabel.append(reason);
        const save = document.createElement("button");
        save.type = "button";
        save.textContent = "记录教师决定";
        save.addEventListener("click", async () => {
          const explanation = reason.value.trim();
          if (!explanation) {
            alignmentMessage("请写明教师决定的依据或调整原因。", true);
            return;
          }
          save.disabled = true;
          try {
            await api(
              "/api/v1/teacher/alignment-runs/" +
                encodeURIComponent(run.run_ref) +
                "/students/" +
                encodeURIComponent(recommendation.student_ref) +
                "/decision",
              "POST",
              {
                decision: action.value,
                reason: explanation,
                override_group:
                  action.value === "override" ? overrideGroup.value : null,
              },
            );
            await loadAlignmentRun(run.run_ref);
            alignmentMessage("教师决定已记录，原建议快照保持不变。");
          } catch (error) {
            alignmentMessage((error as Error).message, true);
            save.disabled = false;
          }
        });
        controls.append(actionLabel, groupLabel, reasonLabel, save);
        item.append(controls);
      }
      alignmentRecommendations.append(item);
    }
    if (run.recommendations.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "这次快照没有学生建议。";
      alignmentRecommendations.append(empty);
    }
  }

  async function loadAlignmentRun(runRef: string): Promise<void> {
    if (!runRef) {
      alignmentRecommendations.replaceChildren();
      alignmentMessage(
        "该里程碑暂无建议快照。请让教师 Agent 通过 MCP 生成预览。",
      );
      return;
    }
    const result = await api<AlignmentRun>(
      "/api/v1/teacher/alignment-runs/" + encodeURIComponent(runRef),
    );
    if (alignmentRun.value !== runRef) return;
    renderAlignmentRun(result);
    alignmentMessage(
      "规则 " +
        result.rule_version +
        " · " +
        result.recommendations.length +
        " 位学生。确认前请查看依据。",
    );
  }

  async function selectMilestone(): Promise<void> {
    const chosen = alignmentMilestone.value;
    const filtered = runs.filter((item) => item.milestone_ref === chosen);
    alignmentRun.replaceChildren();
    for (const item of filtered) {
      alignmentRun.add(
        new Option(
          new Date(item.created_at).toLocaleString("zh-CN") +
            " · " +
            item.recommendation_count +
            " 位学生",
          item.run_ref,
        ),
      );
    }
    try {
      await loadAlignmentRun(alignmentRun.value);
    } catch (error) {
      alignmentMessage((error as Error).message, true);
    }
  }

  async function loadAlignment(): Promise<void> {
    const sequence = ++alignmentLoadSequence;
    alignmentMessage("正在读取班级里程碑与建议快照……");
    try {
      const [milestoneResult, runResult] = await Promise.all([
        api<{ milestones: Milestone[] }>(
          "/api/v1/teacher/classes/" +
            encodeURIComponent(classRef) +
            "/milestones",
        ),
        api<{ runs: AlignmentRunSummary[] }>(
          "/api/v1/teacher/classes/" +
            encodeURIComponent(classRef) +
            "/alignment-runs",
        ),
      ]);
      if (sequence !== alignmentLoadSequence) return;
      milestones = milestoneResult.milestones;
      runs = runResult.runs;
      alignmentMilestone.replaceChildren();
      for (const item of milestones) {
        alignmentMilestone.add(
          new Option(
            "v" +
              item.version +
              " · " +
              item.capability_node +
              " · " +
              item.target_date,
            item.milestone_id,
          ),
        );
      }
      if (milestones.length === 0) {
        alignmentRun.replaceChildren();
        alignmentRecommendations.replaceChildren();
        alignmentMessage("暂无共同能力里程碑。请先由教师确认班级目标。");
        return;
      }
      await selectMilestone();
    } catch (error) {
      if (sequence !== alignmentLoadSequence) return;
      alignmentMilestone.replaceChildren();
      alignmentRun.replaceChildren();
      alignmentRecommendations.replaceChildren();
      alignmentMessage(
        "进度对齐暂不可用。请检查教师策略与本地 API：" +
          (error as Error).message,
        true,
      );
    }
  }

  async function loadArchive(ref: string): Promise<void> {
    const result = await api<{ artifacts: ArchiveArtifact[] }>(
      "/api/v1/teacher/students/" + encodeURIComponent(ref) + "/archive",
    );
    if (studentRef !== ref) return;
    artifacts.replaceChildren();
    if (result.artifacts.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "尚无归档记录。";
      artifacts.append(empty);
      return;
    }
    for (const artifact of result.artifacts) {
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent =
        artifact.kind +
        " · " +
        artifact.source_ref +
        " · " +
        artifact.export_state;
      const verify = document.createElement("button");
      verify.type = "button";
      verify.textContent = "校验";
      verify.addEventListener("click", async () => {
        try {
          const result = await api<{ verified: boolean }>(
            "/api/v1/teacher/students/" +
              encodeURIComponent(ref) +
              "/archive/" +
              encodeURIComponent(artifact.artifact_id) +
              "/verify",
          );
          message(
            result.verified ? "归档校验通过。" : "归档校验失败。",
            !result.verified,
          );
        } catch (error) {
          message((error as Error).message, true);
        }
      });
      row.append(label, verify);
      artifacts.append(row);
    }
  }

  async function loadStudent(ref: string): Promise<void> {
    const sequence = ++studentLoadSequence;
    try {
      const value = await api<StudentProfile>(
        "/api/v1/teacher/students/" + encodeURIComponent(ref),
      );
      if (sequence !== studentLoadSequence) return;
      studentRef = ref;
      version = value.version;
      required<HTMLElement>(dashboard, "#student-title").textContent =
        value.display_name + "的档案";
      required<HTMLElement>(dashboard, "#student-version").textContent =
        "v" + version;
      required<HTMLElement>(dashboard, "#student-meta").textContent =
        value.age +
        " 岁 · " +
        value.grade +
        " 年级 · 教材 " +
        value.book_id +
        " · 进度 " +
        (value.school_progress || "未记录");
      for (const name of [
        "display_name",
        "public_alias",
        "teacher_notes",
        "learning_goals",
      ] as const) {
        const field = required<HTMLInputElement | HTMLTextAreaElement>(
          profileForm,
          '[name="' + name + '"]',
        );
        field.value = value[name] || "";
      }
      studentPanel.hidden = false;
      let archiveFailed = false;
      try {
        await loadArchive(ref);
      } catch (error) {
        archiveFailed = true;
        if (sequence === studentLoadSequence) {
          message(
            "档案已读取，归档暂不可用：" + (error as Error).message,
            true,
          );
        }
      }
      if (sequence !== studentLoadSequence) return;
      await Promise.all([
        teacherReports.loadStudentReports(ref),
        teacherPlans.loadStudentPlans(ref),
      ]);
      if (sequence === studentLoadSequence && !archiveFailed)
        message("档案已读取。");
    } catch (error) {
      if (sequence !== studentLoadSequence) return;
      studentPanel.hidden = true;
      message((error as Error).message, true);
    }
  }

  async function loadRoster(): Promise<void> {
    const result = await api<{ students: StudentSummary[]; has_more: boolean }>(
      "/api/v1/teacher/classes/" + encodeURIComponent(classRef) + "/students",
    );
    rosterNames = new Map(
      result.students.map((item) => [item.student_ref, item.display_name]),
    );
    roster.replaceChildren();
    required<HTMLElement>(dashboard, "#roster-count").textContent =
      result.students.length + " 位学生";
    required<HTMLElement>(dashboard, "#roster-more").hidden = !result.has_more;
    if (result.students.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "这个班级尚无学生档案。";
      roster.append(empty);
    }
    for (const student of result.students) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(
        "aria-current",
        String(studentRef === student.student_ref),
      );
      const name = document.createElement("span");
      name.textContent = student.display_name;
      const detail = document.createElement("small");
      detail.textContent = student.grade + " 年级 · " + student.public_alias;
      button.append(name, detail);
      button.addEventListener(
        "click",
        () => void loadStudent(student.student_ref),
      );
      item.append(button);
      roster.append(item);
    }
    workspace.hidden = false;
  }

  async function connectTeacher(): Promise<void> {
    token = required<HTMLInputElement>(
      dashboard,
      "#teacher-token",
    ).value.trim();
    classRef = required<HTMLInputElement>(
      dashboard,
      "#teacher-class",
    ).value.trim();
    required<HTMLInputElement>(dashboard, "#teacher-token").value = "";
    studentRef = "";
    studentLoadSequence++;
    alignmentLoadSequence++;
    studentPanel.hidden = true;
    workspace.hidden = true;
    try {
      if (!token || !classRef)
        throw new Error("请填写班级 ID 和本地演示令牌。");
      await loadRoster();
      message("已连接班级 " + classRef + "。");
      await Promise.all([loadAlignment(), teacherReports.loadPending()]);
    } catch (error) {
      token = "";
      message((error as Error).message, true);
    }
  }

  async function saveProfile(): Promise<void> {
    if (!studentRef) return;
    const field = (name: string) =>
      required<HTMLInputElement | HTMLTextAreaElement>(
        profileForm,
        '[name="' + name + '"]',
      ).value;
    try {
      await api<StudentProfile>(
        "/api/v1/teacher/students/" + encodeURIComponent(studentRef),
        "PUT",
        {
          expected_version: version,
          display_name: field("display_name"),
          public_alias: field("public_alias"),
          teacher_notes: field("teacher_notes"),
          learning_goals: field("learning_goals"),
        },
      );
      await loadStudent(studentRef);
      await loadRoster();
      message("档案修订已保存并归档。");
    } catch (error) {
      message((error as Error).message, true);
    }
  }

  required<HTMLButtonElement>(dashboard, "#alignment-refresh").addEventListener(
    "click",
    () => void loadAlignment(),
  );
  alignmentMilestone.addEventListener("change", () => void selectMilestone());
  alignmentRun.addEventListener(
    "change",
    () => void loadAlignmentRun(alignmentRun.value),
  );

  required<HTMLButtonElement>(connect, "button").addEventListener(
    "click",
    () => void connectTeacher(),
  );
  connect.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void connectTeacher();
    }
  });
  required<HTMLButtonElement>(profileForm, "button").addEventListener(
    "click",
    () => void saveProfile(),
  );
  profileForm.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void saveProfile();
    }
  });
}
