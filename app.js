const CONTRACT_ADDRESS = "ВАШ_АДРЕС_СМАРТ_КОНТРАКТА";  // адрес смарт контракта

const ABI = [
  "function taskCount() view returns (uint256)",
  "function addTask(string title, string description, string category, string date)",
  "function completeTask(uint256 id)",
  "function deleteTask(uint256 id)",
  "function getTask(uint256 id) view returns (uint256, string, string, string, string, bool, address)",
  "function getMyTaskIds() view returns (uint256[])",
  "event TaskAdded(uint256 indexed id, string title, address indexed owner)",
  "event TaskCompleted(uint256 indexed id)",
  "event TaskDeleted(uint256 indexed id)"
];

let contract  = null;
let provider  = null;
let signer    = null;
let currentTab = "active";

async function init() {
    if (typeof window.ethereum === "undefined") {
        showStatus("❌ MetaMask не найден. Установи расширение MetaMask.", "error");
        return;
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer   = await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

        const address = await signer.getAddress();
        showStatus(`✅ Подключено: ${address.slice(0,6)}...${address.slice(-4)}`, "success");

        window.ethereum.on("accountsChanged", () => location.reload());
        window.ethereum.on("chainChanged",    () => location.reload());

        await renderTasks();
    } catch (e) {
        showStatus("❌ Ошибка подключения: " + e.message, "error");
        console.error(e);
    }
}

async function addTask() {
    if (!contract) { showStatus("Сначала подключи MetaMask", "error"); return; }

    const title    = document.getElementById("title").value.trim();
    const desc     = document.getElementById("desc").value.trim();
    const category = document.getElementById("category").value;
    const date     = document.getElementById("date").value;

    if (!title) { showStatus("❌ Введи название задачи", "error"); return; }
    if (!date)  { showStatus("❌ Выбери дату", "error"); return; }

    try {
        setButtonLoading(true, "Отправка в блокчейн...");
        const tx = await contract.addTask(title, desc, category, date);
        showStatus("⏳ Ожидание подтверждения блока...", "info");
        await tx.wait();

        document.getElementById("title").value = "";
        document.getElementById("desc").value  = "";
        document.getElementById("date").value  = "";

        showStatus("✅ Задача сохранена в блокчейн!", "success");
        await renderTasks();
    } catch (e) {
        showStatus("❌ " + (e.reason || e.message), "error");
        console.error(e);
    } finally {
        setButtonLoading(false);
    }
}

async function markDone(id) {
    if (!contract) return;
    try {
        setButtonLoading(true, "Подтверждение...");
        const tx = await contract.completeTask(id);
        await tx.wait();
        showStatus("✅ Задача выполнена!", "success");
        await renderTasks();
    } catch (e) {
        showStatus("❌ " + (e.reason || e.message), "error");
    } finally {
        setButtonLoading(false);
    }
}

async function deleteTask(id) {
    if (!contract) return;
    try {
        setButtonLoading(true, "Удаление...");
        const tx = await contract.deleteTask(id);
        await tx.wait();
        showStatus("🗑 Задача удалена", "info");
        await renderTasks();
    } catch (e) {
        showStatus("❌ " + (e.reason || e.message), "error");
    } finally {
        setButtonLoading(false);
    }
}

async function renderTasks() {
    const container = document.getElementById("tasks");
    container.innerHTML = "<p class='status-msg'>⏳ Загрузка из блокчейна...</p>";

    if (!contract) {
        container.innerHTML = "<p class='status-msg'>🔌 Подключи MetaMask для просмотра задач</p>";
        return;
    }

    try {
        const ids = await contract.getMyTaskIds();

        const search     = document.getElementById("search").value.toLowerCase();
        const cat        = document.getElementById("filterCategory").value;
        const dateFilter = document.getElementById("filterDate").value;
        const today      = new Date();
        today.setHours(0, 0, 0, 0);

        let taskList = [];
        for (const rawId of ids) {
            const id = Number(rawId);
            try {
                const t = await contract.getTask(id);
                taskList.push({ id, title: t[1], desc: t[2], category: t[3], date: t[4], isDone: t[5], owner: t[6] });
            } catch { /* задача удалена */ }
        }

        taskList = taskList.filter(t =>
            t.title.toLowerCase().includes(search) &&
            (cat === "" || t.category === cat)
        );

        if (dateFilter === "near") taskList.sort((a,b) => new Date(a.date) - new Date(b.date));
        if (dateFilter === "far")  taskList.sort((a,b) => new Date(b.date) - new Date(a.date));

        if (currentTab === "done")    taskList = taskList.filter(t => t.isDone);
        if (currentTab === "expired") taskList = taskList.filter(t => !t.isDone && new Date(t.date) < today);
        if (currentTab === "active")  taskList = taskList.filter(t => !t.isDone && new Date(t.date) >= today);

        container.innerHTML = "";
        if (taskList.length === 0) {
            container.innerHTML = "<p class='status-msg'>Задач нет</p>";
            return;
        }

        taskList.forEach(t => {
            const isExpired = !t.isDone && new Date(t.date) < today;
            container.innerHTML += `
            <div class="task ${t.isDone ? 'task-done' : ''} ${isExpired ? 'task-expired' : ''}">
                <h3>${escapeHtml(t.title)}</h3>
                <small>${escapeHtml(t.category)} | ${t.date}</small>
                ${t.desc ? `<p>${escapeHtml(t.desc)}</p>` : ""}
                <div class="actions">
                    ${!t.isDone
                        ? `<button class="btn-done" onclick="markDone(${t.id})">✔ Выполнено</button>`
                        : `<span class="done-label">✔ Выполнено</span>`}
                    <button class="btn-delete" onclick="deleteTask(${t.id})">✖ Удалить</button>
                </div>
            </div>`;
        });
    } catch (e) {
        container.innerHTML = "<p class='status-msg error'>❌ Ошибка загрузки. Проверь адрес контракта в app.js.</p>";
        console.error(e);
    }
}

function setTab(tab, event) {
    currentTab = tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    event.target.classList.add("active");
    renderTasks();
}

function showStatus(msg, type = "info") {
    const el = document.getElementById("statusBar");
    if (!el) return;
    el.textContent  = msg;
    el.className    = "status-bar " + type;
    el.style.display = "block";
    if (type === "success") setTimeout(() => { el.style.display = "none"; }, 4000);
}

function setButtonLoading(state, text = "Добавить") {
    const btn = document.querySelector(".add-btn");
    btn.disabled    = state;
    btn.textContent = state ? text : "Добавить";
}

function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

window.addEventListener("load", init);
