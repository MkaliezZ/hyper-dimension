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
  let token = "";
  let classRef = "";
  let studentRef = "";
  let version = 0;
  let studentLoadSequence = 0;

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
      await loadArchive(ref);
      if (sequence === studentLoadSequence) message("档案已读取。");
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
    studentPanel.hidden = true;
    workspace.hidden = true;
    try {
      if (!token || !classRef)
        throw new Error("请填写班级 ID 和本地演示令牌。");
      await loadRoster();
      message("已连接班级 " + classRef + "。");
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
