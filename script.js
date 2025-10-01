// ==========================================================
// 1. Firebase参照の定義
//    - index.htmlで初期化されたグローバル変数 `database` を使用
// ==========================================================

// NOTE: Firebaseの初期化設定（firebaseConfig, firebase.initializeApp, firebase.database()）は
//       index.htmlの <script> タグ内に配置されています。
//       このファイルでは、index.htmlで定義された 'database' 変数が利用可能です。
//       もしエラーが出る場合は、index.html内の初期化が正しく行われているか確認してください。

// グローバルな database 変数が定義されていることを想定
const database = firebase.database(); 

// 各データベースノードへの参照
const refs = {
    tasks: database.ref('tasks'),
    // emergencyノードをシンプルに保つ
    emergency: database.ref('emergency'), 
    lostFound: database.ref('lostFound'),
    shifts: database.ref('shifts'),
    status: database.ref('status')
};

// ==========================================================
// 2. ユーティリティ関数
// ==========================================================

/**
 * タイムスタンプを読みやすい形式に変換する
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
}

/**
 * 現在の日時をヘッダーに表示する (ID: current-time)
 */
function updateClock() {
    const currentTimeEl = document.getElementById('current-time');
    if (!currentTimeEl) return;
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    currentTimeEl.textContent = now.toLocaleDateString('ja-JP', options);
}
setInterval(updateClock, 1000); 
updateClock();


// NOTE: HTMLに <select> がないので populateTimeSelectors() は不要です。

// ==========================================================
// 3. リアルタイムデータ処理とHTMLレンダリング
// ==========================================================

// --- A. 処理中のタスク (ID: task-list, new-task-input, add-task-btn) ---
const taskListEl = document.getElementById('task-list');

refs.tasks.on('value', (snapshot) => {
    taskListEl.innerHTML = '';
    const tasks = snapshot.val();
    if (!tasks) return;

    // 新しいタスクを上に表示するため、キーを逆順に取得
    const keys = Object.keys(tasks).reverse(); 
    keys.forEach(key => {
        const task = tasks[key];
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        
        listItem.innerHTML = `
            <div class="list-content">
                <span class="list-text">${task.name}</span>
                <span class="list-meta">追加: ${formatTimestamp(task.timestamp)}</span>
            </div>
            <button class="delete-button" data-key="${key}">&#x2714;</button> 
        `;
        taskListEl.appendChild(listItem);
    });

    // イベントリスナーの再設定 (データ更新の度に必要)
    taskListEl.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.currentTarget.dataset.key;
            refs.tasks.child(key).remove();
        });
    });
});

document.getElementById('add-task-btn').addEventListener('click', () => {
    const input = document.getElementById('new-task-input');
    const taskName = input.value.trim();
    if (taskName) {
        refs.tasks.push({
            name: taskName,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        input.value = '';
    }
});

// --- B. 緊急事態 (ID: emergency-display, emergency-status, update-emergency-btn) ---
const emergencyDisplayEl = document.getElementById('emergency-display');
const emergencySelectEl = document.getElementById('emergency-status');

// 読み取りリスナー: データが変更されたら画面を更新
refs.emergency.on('value', (snapshot) => {
    const status = snapshot.val();
    
    // データ構造は {value: '発生', timestamp: 123456789} を想定
    if (status && status.value) {
        const text = `${status.value} (${formatTimestamp(status.timestamp)})`;
        emergencyDisplayEl.textContent = text;
        
        // スタイル変更ロジック
        if (status.value === '発生' || status.value === '警報発令') {
            emergencyDisplayEl.style.backgroundColor = '#fee2e2'; // Light Red
            emergencyDisplayEl.style.color = '#dc2626'; // Dark Red
            emergencyDisplayEl.style.border = '2px solid #dc2626';
        } else {
            // 解除、またはその他の通常ステータス
            emergencyDisplayEl.textContent = status.value === '解除' ? '状況解除' : text;
            emergencyDisplayEl.style.backgroundColor = '#d1d5db'; // Gray
            emergencyDisplayEl.style.color = '#1f2937'; 
            emergencyDisplayEl.style.border = '1px solid #9ca3af';
        }
    } else {
        // データがない場合（初期状態または完全に削除された場合）
        emergencyDisplayEl.textContent = '緊急状況なし';
        emergencyDisplayEl.style.backgroundColor = '#f3f4f6';
        emergencyDisplayEl.style.color = '#6b7280';
        emergencyDisplayEl.style.border = 'none';
    }
});

// 書き込みリスナー: 更新ボタンが押されたらデータをセット（上書き）
document.getElementById('update-emergency-btn').addEventListener('click', () => {
    const value = emergencySelectEl.value;
    if (value) {
        // set() メソッドでノード全体を上書きし、常に最新の状況のみを保持する
        refs.emergency.set({ 
            value: value,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        emergencySelectEl.value = '';
    }
});


// --- C. 落とし物・連絡事項 (ID: lost-item-list, lost-item-name, lost-item-location, add-lost-item-btn) ---
const lostFoundListEl = document.getElementById('lost-item-list');

refs.lostFound.on('value', (snapshot) => {
    lostFoundListEl.innerHTML = '';
    const items = snapshot.val();
    if (!items) return;

    const keys = Object.keys(items).reverse();
    keys.forEach(key => {
        const item = items[key];
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        listItem.innerHTML = `
            <div class="list-content">
                <span class="list-text">品名: ${item.name} / 場所: ${item.location}</span>
                <span class="list-meta">報告: ${formatTimestamp(item.timestamp)}</span>
            </div>
            <button class="delete-button" data-key="${key}">削除</button>
        `;
        lostFoundListEl.appendChild(listItem);
    });

    lostFoundListEl.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.currentTarget.dataset.key;
            refs.lostFound.child(key).remove();
        });
    });
});

document.getElementById('add-lost-item-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('lost-item-name');
    const locationInput = document.getElementById('lost-item-location');
    const name = nameInput.value.trim();
    const location = locationInput.value.trim();

    if (name && location) {
        refs.lostFound.push({
            name: name,
            location: location,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        nameInput.value = '';
        locationInput.value = '';
    }
});

// --- D. 役員シフト/担当者割当 (ID: shift-list, shift-time-start, shift-time-end, shift-person, shift-role, add-shift-btn) ---
const shiftListEl = document.getElementById('shift-list');

refs.shifts.on('value', (snapshot) => {
    shiftListEl.innerHTML = '';
    const items = snapshot.val();
    if (!items) return;

    const keys = Object.keys(items).reverse();
    keys.forEach(key => {
        const shift = items[key];
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        
        // NOTE: HTML側で <select> の ID が `shift-time-start` と `shift-time-end` であることを想定
        listItem.innerHTML = `
            <div class="list-content">
                <span class="list-text">${shift.start}〜${shift.end} | 担当: ${shift.person} (${shift.role})</span>
                <span class="list-meta">登録: ${formatTimestamp(shift.timestamp)}</span>
            </div>
            <button class="delete-button" data-key="${key}">削除</button>
        `;
        shiftListEl.appendChild(listItem);
    });

    shiftListEl.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.currentTarget.dataset.key;
            refs.shifts.child(key).remove();
        });
    });
});

document.getElementById('add-shift-btn').addEventListener('click', () => {
    const shiftTimeStartEl = document.getElementById('shift-time-start');
    const shiftTimeEndEl = document.getElementById('shift-time-end');
    const personInput = document.getElementById('shift-person');
    const roleInput = document.getElementById('shift-role');
    
    // HTML側で時刻のセレクトボックスが必須
    const start = shiftTimeStartEl.value;
    const end = shiftTimeEndEl.value;
    const person = personInput.value.trim();
    const role = roleInput.value.trim();

    if (start && end && person && role) {
        refs.shifts.push({
            start: start,
            end: end,
            person: person,
            role: role,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        personInput.value = '';
        roleInput.value = '';
    }
});


// --- E. 混雑状況の共有 (ID: status-display-area, status-location, status-level, update-status-btn) ---
const statusDisplayAreaEl = document.getElementById('status-display-area');

refs.status.on('value', (snapshot) => {
    statusDisplayAreaEl.innerHTML = '';
    const statuses = snapshot.val();
    if (!statuses) return;

    // 状況を場所ごとに表示 (Statusesはオブジェクトで、キーが場所名)
    // Object.keysで場所のリストを取得
    Object.keys(statuses).forEach(locationKey => {
        const status = statuses[locationKey];
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        
        // 混雑レベルに応じた色分け (CSSの border-left-color に適用)
        let color = '#3b82f6'; // Default Blue
        if (status.level === '大変混雑') color = '#dc2626'; // Red
        else if (status.level === 'やや混雑') color = '#f59e0b'; // Amber
        
        listItem.style.borderLeftColor = color;
        
        listItem.innerHTML = `
            <div class="list-content">
                <span class="list-text">場所: ${status.location} / 状況: ${status.level}</span>
                <span class="list-meta">最終更新: ${formatTimestamp(status.timestamp)}</span>
            </div>
        `;
        statusDisplayAreaEl.appendChild(listItem);
    });
});

document.getElementById('update-status-btn').addEventListener('click', () => {
    const location = document.getElementById('status-location').value;
    const level = document.getElementById('status-level').value;

    if (location && level) {
        // 場所をキー（ノード名）にして上書き保存する
        refs.status.child(location).set({
            location: location,
            level: level,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }
});