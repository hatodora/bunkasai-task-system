document.addEventListener('DOMContentLoaded', () => {
    // ⚠️ Firebaseの設定がindex.htmlで完了していることを前提とします。
    // ------------------------------------------
    // --- 1. Firebase データベースの参照を取得 ---
    // ------------------------------------------
    const database = firebase.database();
    
    // データ格納用の参照パスを定義
    const tasksRef = database.ref('tasks');
    const lostFoundsRef = database.ref('lost-founds');
    const shiftsRef = database.ref('shifts');
    const crowdsRef = database.ref('crowds');
    // ------------------------------------------

    // --- 2. DOM要素の取得 ---
    const timeElement = document.getElementById('current-time');
    const dateElement = document.getElementById('current-date');
    const weatherElement = document.getElementById('weather');
    const weatherIconElement = document.getElementById('weather-icon');

    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const taskHistoryList = document.getElementById('task-history-list');
    const toggleTaskHistoryButton = document.getElementById('toggle-task-history');

    const lostFoundForm = document.getElementById('lost-found-form');
    const lostFoundItemInput = document.getElementById('lost-found-item-input');
    const lostFoundLocationInput = document.getElementById('lost-found-location-input');
    const lostFoundList = document.getElementById('lost-found-list');
    const lostFoundHistoryList = document.getElementById('lost-found-history-list');
    const toggleLostFoundHistoryButton = document.getElementById('toggle-lost-found-history');

    const emergencySelect = document.getElementById('emergency-select');
    const alertButton = document.getElementById('alert-button');
    const alertOverlay = document.getElementById('alert-overlay');
    const alertMessage = document.getElementById('alert-message');
    const alertOkButton = document.getElementById('alert-ok-button');
    const alertCancelButton = document.getElementById('alert-cancel-button');
    const fullScreenAlert = document.getElementById('full-screen-alert');
    const fullScreenMessage = document.getElementById('full-screen-message');
    
    const activeEmergencySection = document.getElementById('active-emergency-section');
    const activeEmergencyMessage = document.getElementById('active-emergency-message');
    const resolveButton = document.getElementById('resolve-button');

    const shiftTableBody = document.querySelector('#shift-table tbody');
    const shiftForm = document.getElementById('shift-form');
    const shiftStartTimeInput = document.getElementById('shift-start-time-input');
    const shiftEndTimeInput = document.getElementById('shift-end-time-input');
    const shiftPersonInput = document.getElementById('shift-person-input');
    const shiftRoleInput = document.getElementById('shift-role-input');
    const crowdForm = document.getElementById('crowd-form');
    const crowdLocationInput = document.getElementById('crowd-location-input');
    const crowdStatusInput = document.getElementById('crowd-status-input');
    const crowdList = document.getElementById('crowd-list');

    let isResolving = false;
    let currentEmergency = '';

    // --- 3. 天気APIの設定と関数 ---
    const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast?latitude=35.658&longitude=139.701&current=temperature_2m,precipitation_probability,weather_code&timezone=Asia%2FTokyo&forecast_days=1";

    function getWeatherDisplay(code) {
        if (code === 0) return { icon: '☀️', text: '晴れ' };
        if (code >= 1 && code <= 3) return { icon: '🌤️', text: 'おおむね晴れ' };
        if (code >= 45 && code <= 48) return { icon: '🌫️', text: '霧' };
        if (code >= 51 && code <= 55) return { icon: ' drizzle', text: '霧雨' };
        if (code >= 61 && code <= 65) return { icon: '🌧️', text: '雨' };
        if (code >= 71 && code <= 75) return { icon: '❄️', text: '雪' };
        if (code >= 80 && code <= 82) return { icon: '☔️', text: 'にわか雨' };
        if (code >= 95 && code <= 99) return { icon: '⛈️', text: '雷雨' };
        return { icon: '❓', text: '不明' };
    }

    async function updateWeather() {
        try {
            const response = await fetch(WEATHER_API_URL);
            if (!response.ok) throw new Error('Failed to fetch weather data');
            
            const data = await response.json();
            
            const temp = data.current.temperature_2m;
            const precipProb = data.current.precipitation_probability || 0; // %
            const weatherCode = data.current.weather_code;
            const weatherDisplay = getWeatherDisplay(weatherCode);

            weatherIconElement.textContent = weatherDisplay.icon;
            weatherElement.textContent = `${Math.round(temp)}°C ${weatherDisplay.text} (降水: ${precipProb}%)`; 

        } catch (error) {
            console.error("天気情報の取得に失敗しました:", error);
            weatherElement.textContent = '天気情報取得エラー';
            weatherIconElement.textContent = '⚠️';
        }
    }

    // --- 4. リアルタイムデータリスナーとレンダリング関数 ---

    // タスクのリアルタイム更新
    tasksRef.on('value', (snapshot) => {
        taskList.innerHTML = ''; 
        taskHistoryList.innerHTML = ''; 
        
        snapshot.forEach((childSnapshot) => {
            const taskKey = childSnapshot.key;
            const task = childSnapshot.val();
            
            const isCompleted = task.completed || false;
            const targetList = isCompleted ? taskHistoryList : taskList;

            const li = document.createElement('li');
            li.textContent = task.text;

            const completeButton = document.createElement('button');
            completeButton.textContent = isCompleted ? '未完了に戻す' : '完了';
            completeButton.className = isCompleted ? 'btn danger-btn small-btn' : 'btn accent-btn small-btn';
            
            completeButton.onclick = () => {
                tasksRef.child(taskKey).update({ completed: !isCompleted });
            };
            
            li.appendChild(completeButton);
            if (isCompleted) {
                li.classList.add('complete');
                targetList.prepend(li);
            } else {
                targetList.appendChild(li);
            }
        });
    });

    // 落とし物のリアルタイム更新
    lostFoundsRef.on('value', (snapshot) => {
        lostFoundList.innerHTML = '';
        lostFoundHistoryList.innerHTML = '';
        
        snapshot.forEach((childSnapshot) => {
            const lfKey = childSnapshot.key;
            const lf = childSnapshot.val();
            
            const isResolved = lf.resolved || false;
            const targetList = isResolved ? lostFoundHistoryList : lostFoundList;

            const li = document.createElement('li');
            li.innerHTML = `<strong>${lf.item}</strong><br>場所: ${lf.location}`;

            const resolveButton = document.createElement('button');
            resolveButton.textContent = isResolved ? '未解決に戻す' : '解決';
            resolveButton.className = isResolved ? 'btn danger-btn small-btn' : 'btn accent-btn small-btn';
            
            resolveButton.onclick = () => {
                lostFoundsRef.child(lfKey).update({ resolved: !isResolved });
            };
            
            li.appendChild(resolveButton);
            if (isResolved) {
                li.classList.add('complete');
                li.innerHTML += `<span style="font-size:0.8em; color:#34c759;"> (解決済)</span>`;
                targetList.prepend(li);
            } else {
                targetList.appendChild(li);
            }
        });
    });

    // シフトのレンダリングとチェック
    function renderAndCheckShifts(shiftsData) {
        shiftTableBody.innerHTML = '';
        const now = new Date();
        const currentDateStr = now.toISOString().slice(0, 10);
        const currentTime = now.getTime();
        
        const shiftsArray = Object.keys(shiftsData || {}).map(key => ({
            key: key,
            ...shiftsData[key]
        }));

        shiftsArray.forEach((shift) => {
            const startTimestamp = Date.parse(`${currentDateStr}T${shift.startTime}:00`);
            const endTimestamp = Date.parse(`${currentDateStr}T${shift.endTime}:00`);

            // 終了時刻を過ぎたら自動でDBから削除
            if (currentTime > endTimestamp) {
                shiftsRef.child(shift.key).remove();
                return; 
            }
            
            const row = document.createElement('tr');
            row.dataset.key = shift.key;
            
            row.innerHTML = `
                <td class="shift-time-cell">${shift.startTime}〜${shift.endTime}</td>
                <td>${shift.person}</td>
                <td>${shift.role}</td>
                <td><button class="end-shift-btn">終了済み</button></td>
            `;

            if (currentTime >= startTimestamp && currentTime < endTimestamp) {
                row.classList.add('active-shift');
            }

            shiftTableBody.appendChild(row);
        });
        
        // イベントリスナーを再設定
        document.querySelectorAll('.end-shift-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const key = row.dataset.key;
                shiftsRef.child(key).remove(); 
            });
        });
    }

    // シフトのリアルタイムリスナー
    shiftsRef.on('value', (snapshot) => {
        renderAndCheckShifts(snapshot.val()); 
    });

    // 混雑状況のリアルタイムリスナー
    crowdsRef.on('value', (snapshot) => {
        const crowdData = snapshot.val() || {}; 
        crowdList.innerHTML = '';
        
        for (const location in crowdData) {
            const status = crowdData[location];
            const li = document.createElement('li');
            li.innerHTML = `<strong>${location}:</strong> <span class="crowd-status crowd-status-${status}">${status}</span>`;
            crowdList.appendChild(li);
        }
    });


    // --- 5. 時刻更新とユーティリティ関数 ---

    // 現在の時刻と日付を表示し、シフトステータスを更新
    function updateDateTime() {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        dateElement.textContent = now.toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // シフトの状態をチェックし、DOMのクラスを更新
        const currentDateStr = now.toISOString().slice(0, 10);
        const currentTime = now.getTime();

        document.querySelectorAll('#shift-table tr').forEach(row => {
            const timeCell = row.querySelector('td.shift-time-cell');
            if (!timeCell) return;
            
            const timeRange = timeCell.textContent.split('〜');
            const [startTimeStr, endTimeStr] = timeRange;
            if (!startTimeStr || !endTimeStr) return;

            const startTimestamp = Date.parse(`${currentDateStr}T${startTimeStr}:00`);
            const endTimestamp = Date.parse(`${currentDateStr}T${endTimeStr}:00`);
            
            if (currentTime >= startTimestamp && currentTime < endTimestamp) {
                row.classList.add('active-shift');
            } else {
                row.classList.remove('active-shift');
            }
        });
    }
    
    // 履歴表示のトグル関数
    function toggleHistory(historyList, button) {
        if (historyList.style.display === 'none') {
            historyList.style.display = 'block';
            button.textContent = button.textContent.replace('を表示', 'を非表示');
        } else {
            historyList.style.display = 'none';
            button.textContent = button.textContent.replace('を非表示', 'を表示');
        }
    }

    // --- 6. イベントリスナー (データベース書き込み) ---

    // タスクフォームの送信
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (taskInput.value.trim() !== '') {
            const newTask = {
                text: taskInput.value.trim(),
                timestamp: Date.now(),
                completed: false 
            };
            tasksRef.push(newTask); 
            taskInput.value = '';
        }
    });
    
    // タスク履歴のトグル
    toggleTaskHistoryButton.addEventListener('click', () => {
        toggleHistory(taskHistoryList, toggleTaskHistoryButton);
    });

    // 落とし物フォームの送信
    lostFoundForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (lostFoundItemInput.value.trim() !== '' && lostFoundLocationInput.value.trim() !== '') {
            const newLostFound = {
                item: lostFoundItemInput.value.trim(),
                location: lostFoundLocationInput.value.trim(),
                timestamp: Date.now(),
                resolved: false
            };
            lostFoundsRef.push(newLostFound);
            lostFoundItemInput.value = '';
            lostFoundLocationInput.value = '';
        }
    });

    // 落とし物履歴のトグル
    toggleLostFoundHistoryButton.addEventListener('click', () => {
        toggleHistory(lostFoundHistoryList, toggleLostFoundHistoryButton);
    });

    // シフトフォームの送信
    shiftForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const startTime = shiftStartTimeInput.value;
        const endTime = shiftEndTimeInput.value;
        if (!startTime || !endTime || !shiftPersonInput.value || !shiftRoleInput.value) {
             alert('すべてのシフト情報を入力してください。');
             return;
        }

        const newShift = {
            startTime: startTime,
            endTime: endTime,
            person: shiftPersonInput.value,
            role: shiftRoleInput.value
        };
        shiftsRef.push(newShift);
        shiftForm.reset();
    });

    // 混雑状況フォームの送信
    crowdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const location = crowdLocationInput.value;
        const status = crowdStatusInput.value;
        if (location && status) {
            crowdsRef.child(location).set(status); 
            crowdForm.reset();
        } else {
            alert('場所と状況を選択してください。');
        }
    });

    // 警報関連の処理 (省略なし)
    alertOkButton.addEventListener('click', () => {
        if (isResolving) {
            alertOverlay.style.display = 'none';
            activeEmergencySection.style.display = 'none';
            currentEmergency = '';
            isResolving = false;
        } else {
            const selectedEmergency = emergencySelect.value;
            alertOverlay.style.display = 'none';
            fullScreenMessage.textContent = selectedEmergency;
            fullScreenAlert.style.display = 'flex';
            currentEmergency = selectedEmergency;

            setTimeout(() => {
                fullScreenAlert.style.display = 'none';
                activeEmergencyMessage.textContent = currentEmergency;
                activeEmergencySection.style.display = 'flex';
            }, 10000);
        }
    });

    alertCancelButton.addEventListener('click', () => {
        alertOverlay.style.display = 'none';
        isResolving = false;
    });

    alertButton.addEventListener('click', () => {
        const selectedEmergency = emergencySelect.value;
        if (selectedEmergency) {
            alertMessage.textContent = `${selectedEmergency}が発生しました。これで警報を発しますか？`;
            alertOverlay.style.display = 'flex';
            isResolving = false;
        } else {
            alert('緊急事態を選択してください。');
        }
    });

    resolveButton.addEventListener('click', () => {
        if (currentEmergency) {
            alertMessage.textContent = `${currentEmergency}は解決しましたか？`;
            alertOverlay.style.display = 'flex';
            isResolving = true;
        } else {
            alert('現在発令中の緊急事態はありません。');
        }
    });

    // --- 7. 初期化とタイマー設定 ---
    
    // 1秒ごとに時刻を更新（シフトのハイライトチェックも含む）
    setInterval(updateDateTime, 1000);
    // 10分ごとに天気を更新
    setInterval(updateWeather, 600000); 

    updateDateTime();
    updateWeather();


    // --- 8. 開発補助機能: 自動リロード設定 ---
    // ⚠️ 本番環境にデプロイする際は、この機能全体を削除してください。
    (function setupAutoReload() {
        const RELOAD_INTERVAL_MS = 3000; 
        let lastModified = null;

        function fetchLastModified() {
            fetch(window.location.href, { cache: 'no-store', method: 'HEAD' })
                .then(response => {
                    const currentLastModified = response.headers.get('Last-Modified');
                    
                    if (currentLastModified) {
                        if (lastModified === null) {
                            lastModified = currentLastModified;
                            console.log('自動リロード監視を開始しました。');
                        } else if (lastModified !== currentLastModified) {
                            console.log('ファイルの変更を検出しました。リロードします...');
                            window.location.reload(true);
                        }
                    }
                })
                .catch(error => {
                    // console.warn('自動リロードチェック中にエラーが発生しました:', error);
                });
        }

        setInterval(fetchLastModified, RELOAD_INTERVAL_MS);
    })();
});