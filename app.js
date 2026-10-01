/* =========================================
   SETTINGS
========================================= */

const STORAGE_KEY = "project-tree-v1";

// level 0 = Milestone, level 1..7 = Tasks / Subtasks
const MAX_SUBTASK_LEVEL = 7;


/* =========================================
   DATA
========================================= */

let projects = loadProjects();

function loadProjects() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    render();
}


/* =========================================
   HELPERS
========================================= */

function generateId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now() + "-" + Math.random();
}

function createNode(name, level) {
    return {
        id: generateId(),
        name: name,
        completed: false,
        collapsed: false,
        level: level,
        children: []
    };
}

function askName(message, defaultValue = "") {
    const result = prompt(message, defaultValue);
    if (!result || !result.trim()) {
        return null;
    }
    return result.trim();
}

function findProject(projectId) {
    return projects.find(p => p.id === projectId);
}

function findNode(nodes, id) {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }
        const found = findNode(node.children, id);
        if (found) {
            return found;
        }
    }
    return null;
}

function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, character => map[character]);
}


/* =========================================
   PROGRESS
========================================= */

// No children: 100 if completed, else 0.
// With children: average of the children's progress.
function calculateNodeProgress(node) {
    if (node.children.length === 0) {
        return node.completed ? 100 : 0;
    }
    const total = node.children.reduce(
        (sum, child) => sum + calculateNodeProgress(child),
        0
    );
    return Math.round(total / node.children.length);
}

function calculateProjectProgress(project) {
    if (project.milestones.length === 0) {
        return 0;
    }
    const total = project.milestones.reduce(
        (sum, milestone) => sum + calculateNodeProgress(milestone),
        0
    );
    return Math.round(total / project.milestones.length);
}


/* =========================================
   ACTIONS
========================================= */

function addProject() {
    const name = askName("اسم المشروع؟");
    if (!name) return;

    projects.push({
        id: generateId(),
        name: name,
        milestones: []
    });
    save();
}

function addMilestone(projectId) {
    const project = findProject(projectId);
    if (!project) return;

    const name = askName("اسم الـ Milestone؟");
    if (!name) return;

    project.milestones.push(createNode(name, 0));
    save();
}

function addChild(projectId, nodeId) {
    const project = findProject(projectId);
    if (!project) return;

    const node = findNode(project.milestones, nodeId);
    if (!node) return;

    if (node.level >= MAX_SUBTASK_LEVEL) {
        alert("وصلت إلى الحد الأقصى: " + MAX_SUBTASK_LEVEL + " مستويات.");
        return;
    }

    const childLevel = node.level + 1;
    const name = askName("اسم المستوى " + childLevel + "؟");
    if (!name) return;

    node.children.push(createNode(name, childLevel));
    node.collapsed = false;
    save();
}

function editNode(projectId, nodeId) {
    const project = findProject(projectId);
    if (!project) return;

    const node = findNode(project.milestones, nodeId);
    if (!node) return;

    const newName = askName("تعديل الاسم:", node.name);
    if (!newName) return;

    node.name = newName;
    save();
}

function toggleNode(projectId, nodeId) {
    const project = findProject(projectId);
    if (!project) return;

    const node = findNode(project.milestones, nodeId);
    if (!node) return;

    // Parents get their progress from their children.
    if (node.children.length > 0) return;

    node.completed = !node.completed;
    save();
}

function toggleCollapse(projectId, nodeId) {
    const project = findProject(projectId);
    if (!project) return;

    const node = findNode(project.milestones, nodeId);
    if (!node) return;

    node.collapsed = !node.collapsed;
    save();
}

function deleteNode(projectId, nodeId) {
    const project = findProject(projectId);
    if (!project) return;

    if (!confirm("حذف هذا العنصر وكل ما تحته؟")) return;

    function remove(nodes) {
        const index = nodes.findIndex(node => node.id === nodeId);
        if (index !== -1) {
            nodes.splice(index, 1);
            return true;
        }
        return nodes.some(node => remove(node.children));
    }

    remove(project.milestones);
    save();
}

function deleteProject(projectId) {
    if (!confirm("حذف المشروع بالكامل؟")) return;

    projects = projects.filter(project => project.id !== projectId);
    save();
}


/* =========================================
   RENDER NODE
========================================= */

function renderNode(project, node) {
    const wrapper = document.createElement("div");
    wrapper.className = "node level-" + Math.min(node.level, 7);

    const hasChildren = node.children.length > 0;
    const progress = calculateNodeProgress(node);
    const isDone = progress === 100;
    const canAddChild = node.level < MAX_SUBTASK_LEVEL;

    const main = document.createElement("div");
    main.className = "node-main";

    main.innerHTML = `
        ${hasChildren
            ? `<button class="toggle-btn" data-toggle>${node.collapsed ? "◀" : "▼"}</button>`
            : `<span style="width:30px"></span>`}

        <input
            type="checkbox"
            class="task-checkbox"
            ${node.completed ? "checked" : ""}
            ${hasChildren ? "disabled" : ""}
        >

        <div class="node-name ${isDone ? "completed" : ""}">
            ${escapeHtml(node.name)}
        </div>

        <div class="node-meta">${progress}%</div>

        <div class="node-tools">
            ${canAddChild ? `<button class="small-btn" data-add title="إضافة">+</button>` : ""}
            <button class="small-btn" data-edit title="تعديل">✎</button>
            <button class="small-btn danger" data-delete title="حذف">✕</button>
        </div>
    `;

    // Events
    const toggleBtn = main.querySelector("[data-toggle]");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => toggleCollapse(project.id, node.id));
    }

    main.querySelector(".task-checkbox")
        .addEventListener("change", () => toggleNode(project.id, node.id));

    const addBtn = main.querySelector("[data-add]");
    if (addBtn) {
        addBtn.addEventListener("click", () => addChild(project.id, node.id));
    }

    main.querySelector("[data-edit]")
        .addEventListener("click", () => editNode(project.id, node.id));

    main.querySelector("[data-delete]")
        .addEventListener("click", () => deleteNode(project.id, node.id));

    wrapper.appendChild(main);

    // Children
    if (hasChildren && !node.collapsed) {
        const childrenBox = document.createElement("div");
        childrenBox.className = "node-children";

        node.children.forEach(child => {
            childrenBox.appendChild(renderNode(project, child));
        });

        wrapper.appendChild(childrenBox);
    }

    return wrapper;
}


/* =========================================
   RENDER PROJECT
========================================= */

function renderProject(project) {
    const template = document.getElementById("projectTemplate");
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".project-card");

    const progress = calculateProjectProgress(project);

    card.querySelector(".project-title").textContent = project.name;
    card.querySelector(".progress-fill").style.width = progress + "%";
    card.querySelector(".progress-text").textContent = progress + "%";

    card.querySelector(".add-milestone-btn")
        .addEventListener("click", () => addMilestone(project.id));

    card.querySelector(".delete-project-btn")
        .addEventListener("click", () => deleteProject(project.id));

    const list = card.querySelector(".milestones");

    if (project.milestones.length === 0) {
        list.innerHTML = `<div class="empty">ما فيه Milestones بعد. اضغط «+ Milestone» للبدء.</div>`;
    } else {
        project.milestones.forEach(milestone => {
            list.appendChild(renderNode(project, milestone));
        });
    }

    return fragment;
}


/* =========================================
   RENDER APP
========================================= */

function render() {
    const app = document.getElementById("app");
    app.innerHTML = "";

    if (projects.length === 0) {
        app.innerHTML = `<div class="empty">ما عندك مشاريع بعد. اضغط «+ مشروع جديد» للبدء.</div>`;
        return;
    }

    projects.forEach(project => {
        app.appendChild(renderProject(project));
    });
}


/* =========================================
   INIT
========================================= */

document
    .getElementById("addProjectBtn")
    .addEventListener("click", addProject);

render();
