/* ============================================================
   Collatz Conjecture — Frontend Logic
   ============================================================ */

const API = '/api';
let chartInstance = null;
let isRunning = false;
let currentSequence = [];

function toggleTheory() {
  document.getElementById('theory-section').classList.toggle('collapsed');
}

function setStat(id, val) {
  document.getElementById(id).textContent = val;
}

function setStatus(text, color) {
  const el = document.getElementById('st-status');
  el.textContent = text;
  el.style.color = color || 'var(--primary)';
}

// ---- Start ----
async function startComputation() {
  const num = parseInt(document.getElementById('input-number').value);
  const mode = document.getElementById('mode-select').value;
  const maxSteps = parseInt(document.getElementById('max-steps').value) || 10000;

  if (!num || num < 1) {
    alert('Введите положительное целое число');
    return;
  }

  if (mode === 'infinite') {
    startInfiniteMode(num, maxSteps);
  } else {
    startUntilOne(num);
  }
}

// ---- Mode: Until One ----
async function startUntilOne(num) {
  setRunningState(true);
  setStat('st-number', num);
  setStatus('Вычисление...', 'var(--warn)');
  document.getElementById('sequence-list').innerHTML = '<div class="loading">Вычисление...</div>';

  try {
    const resp = await fetch(API + '/collatz/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: num, mode: 'until_one', max_steps: 100000 })
    });
    const data = await resp.json();

    if (data.error) {
      document.getElementById('sequence-list').innerHTML = '<div class="error-msg">' + data.error + '</div>';
      setStatus('Ошибка', 'var(--danger)');
      setRunningState(false);
      return;
    }

    currentSequence = data.sequence;
    displaySequence(data.sequence);
    drawChart(data.sequence);
    setStat('st-steps', data.total_steps);
    setStat('st-max', data.max_value);
    setStat('st-current', 1);
    setStatus('Достигнуто 1', 'var(--success)');
    buildTree(data.sequence);
  } catch (err) {
    document.getElementById('sequence-list').innerHTML = '<div class="error-msg">Ошибка: ' + err.message + '</div>';
    setStatus('Ошибка', 'var(--danger)');
  }
  setRunningState(false);
}

// ---- Mode: Infinite ----
function startInfiniteMode(startNum, maxSteps) {
  setRunningState(true);
  setStat('st-number', startNum);
  setStatus('Бесконечный цикл...', 'var(--warn)');

  currentSequence = [];
  let current = startNum;
  let step = 0;
  let maxVal = current;
  const listEl = document.getElementById('sequence-list');
  listEl.innerHTML = '';

  isRunning = true;
  currentSequence.push({ step: 0, value: current, operation: 'start' });
  appendSeqRow(listEl, 0, current, 'start');

  function tick() {
    if (!isRunning || step >= maxSteps) {
      finishInfinite(startNum);
      return;
    }

    var batchSize = 50;
    for (var i = 0; i < batchSize && isRunning && step < maxSteps; i++) {
      step++;
      var op;
      if (current % 2 === 0) {
        current = current / 2;
        op = 'n/2';
      } else {
        current = current * 3 + 1;
        op = '3n+1';
      }
      maxVal = Math.max(maxVal, current);
      currentSequence.push({ step: step, value: current, operation: op });
      appendSeqRow(listEl, step, current, op);
    }

    setStat('st-steps', step);
    setStat('st-max', maxVal);
    setStat('st-current', current);
    listEl.scrollTop = listEl.scrollHeight;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function finishInfinite(startNum) {
  setStatus('Остановлено', 'var(--primary)');
  setRunningState(false);

  fetch(API + '/collatz/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: startNum, mode: 'infinite', max_steps: currentSequence.length })
  }).catch(function() {});

  if (currentSequence.length > 0 && currentSequence.length <= 5000) {
    drawChart(currentSequence);
    buildTree(currentSequence);
  } else if (currentSequence.length > 5000) {
    drawChart(currentSequence.slice(0, 5000));
    buildTree(currentSequence.slice(0, 200));
  }
}

function stopComputation() {
  isRunning = false;
}

function setRunningState(running) {
  document.getElementById('btn-start').disabled = running;
  document.getElementById('btn-stop').disabled = !running;
  if (!running) isRunning = false;
}

// ---- Display sequence ----
function displaySequence(seq) {
  var el = document.getElementById('sequence-list');
  el.innerHTML = '';
  seq.forEach(function(s) { appendSeqRow(el, s.step, s.value, s.operation); });
}

function appendSeqRow(container, step, value, op) {
  var row = document.createElement('div');
  row.className = 'seq-row' + (value % 2 === 0 ? ' seq-even' : '');
  row.innerHTML = '<span class="seq-step">#' + step + '</span><span class="seq-val">' + value + '</span><span class="seq-op">' + op + '</span>';
  container.appendChild(row);
}

// ---- Chart ----
function drawChart(seq) {
  var ctx = document.getElementById('chart-canvas').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  var labels = seq.map(function(s) { return s.step; });
  var values = seq.map(function(s) { return s.value; });

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Значение',
        data: values,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 1.5,
        pointRadius: seq.length > 100 ? 0 : 2,
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#1e293b', font: { family: 'Segoe UI, system-ui, sans-serif' } } }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' }, title: { display: true, text: 'Шаг', color: '#64748b' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' }, title: { display: true, text: 'Значение', color: '#64748b' } }
      }
    }
  });
}

// ---- Tree (D3.js) — Обратное дерево Коллатца ----
// Корень = 1, для каждого n предшественники: 2n и (n-1)/3 (если валидно).
// Путь вычисленной последовательности подсвечивается.

function buildReverseCollatzTree(n, depth, maxDepth, maxVal, seqSet, visited) {
  var node = { value: n, inSequence: seqSet.has(n), children: [] };

  if (depth >= maxDepth || visited.has(n)) return node;
  visited.add(n);

  // Предшественник 1: 2n (обратная операция n/2)
  var c1 = 2 * n;
  if (c1 <= maxVal) {
    // Если на пути последовательности — углубляемся полностью, иначе ограничиваем
    var childDepth = seqSet.has(c1) ? maxDepth : Math.min(maxDepth, depth + 3);
    node.children.push(buildReverseCollatzTree(c1, depth + 1, childDepth, maxVal, seqSet, visited));
  }

  // Предшественник 2: (n-1)/3 (обратная операция 3n+1), только если результат нечётный и > 0
  if (n > 1 && (n - 1) % 3 === 0) {
    var c2 = (n - 1) / 3;
    if (c2 > 0 && c2 % 2 === 1 && c2 !== n && !visited.has(c2) && c2 <= maxVal) {
      var childDepth2 = seqSet.has(c2) ? maxDepth : Math.min(maxDepth, depth + 3);
      node.children.push(buildReverseCollatzTree(c2, depth + 1, childDepth2, maxVal, seqSet, visited));
    }
  }

  return node;
}

function buildTree(seq) {
  var container = document.getElementById('tree-container');
  container.innerHTML = '';

  if (!seq || seq.length === 0) return;

  // Собираем значения последовательности для подсветки пути
  var seqSet = new Set();
  seq.forEach(function(s) { seqSet.add(s.value); });

  var startNum = seq[0].value;
  var maxVal = Math.max(startNum * 3, 500);
  var maxDepth = 18;
  var visited = new Set();

  // Строим обратное дерево от 1
  var root = buildReverseCollatzTree(1, 0, maxDepth, maxVal, seqSet, visited);

  // Подсчёт узлов для размеров
  var totalNodes = 0;
  function countNodes(n) { totalNodes++; n.children.forEach(countNodes); }
  countNodes(root);

  var width = container.clientWidth || 900;
  var height = Math.max(600, Math.min(totalNodes * 24, 2000));

  var svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  var g = svg.append('g').attr('transform', 'translate(60, 20)');

  var treeLayout = d3.tree()
    .size([height - 40, width - 160])
    .separation(function(a, b) { return a.parent === b.parent ? 1 : 1.5; });

  var hierarchy = d3.hierarchy(root);
  treeLayout(hierarchy);

  // Связи
  g.selectAll('.link')
    .data(hierarchy.links())
    .join('path')
    .attr('class', 'link')
    .attr('d', d3.linkHorizontal()
      .x(function(d) { return d.y; })
      .y(function(d) { return d.x; })
    )
    .attr('stroke', function(d) {
      // Подсветить путь последовательности
      if (d.source.data.inSequence && d.target.data.inSequence) return '#2563eb';
      return '#cbd5e1';
    })
    .attr('stroke-width', function(d) {
      if (d.source.data.inSequence && d.target.data.inSequence) return 2.5;
      return 1.2;
    });

  // Узлы
  var node = g.selectAll('.node')
    .data(hierarchy.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', function(d) { return 'translate(' + d.y + ',' + d.x + ')'; });

  node.append('circle')
    .attr('r', function(d) { return d.data.inSequence ? 7 : 4; })
    .attr('fill', function(d) {
      if (d.data.value === 1) return '#059669';
      if (d.data.inSequence && d.data.value % 2 !== 0) return '#dc2626';
      if (d.data.inSequence) return '#2563eb';
      if (d.data.value % 2 === 0) return '#93c5fd';
      return '#fbbf24';
    })
    .attr('stroke', function(d) {
      if (d.data.value === 1) return '#047857';
      if (d.data.inSequence) return '#1e293b';
      return '#94a3b8';
    })
    .attr('stroke-width', function(d) { return d.data.inSequence ? 2 : 1; });

  node.append('text')
    .attr('dy', '0.31em')
    .attr('x', function(d) { return d.children ? -10 : 10; })
    .attr('text-anchor', function(d) { return d.children ? 'end' : 'start'; })
    .text(function(d) { return d.data.value; })
    .attr('font-size', function(d) { return d.data.inSequence ? '11px' : '9px'; })
    .attr('font-weight', function(d) { return d.data.inSequence ? '700' : '400'; })
    .attr('fill', '#1e293b');

  // Легенда
  var legend = svg.append('g').attr('transform', 'translate(' + (width - 260) + ', 20)');
  legend.append('rect').attr('x', -10).attr('y', -10).attr('width', 250).attr('height', 115)
    .attr('fill', '#fff').attr('stroke', '#e2e8f0').attr('rx', 4);

  var items = [
    { color: '#dc2626', label: 'Путь: нечётное (3n+1)' },
    { color: '#2563eb', label: 'Путь: чётное (n/2)' },
    { color: '#059669', label: 'Корень — значение 1' },
    { color: '#fbbf24', label: 'Ветвь: нечётное' },
    { color: '#93c5fd', label: 'Ветвь: чётное' }
  ];
  items.forEach(function(item, i) {
    legend.append('circle').attr('cx', 5).attr('cy', i * 20 + 5).attr('r', 5).attr('fill', item.color);
    legend.append('text').attr('x', 18).attr('y', i * 20 + 9).text(item.label)
      .attr('fill', '#1e293b').attr('font-size', '11px').attr('font-family', 'Segoe UI, sans-serif');
  });
}

// ---- Frequency ----
async function loadFrequency() {
  var tbody = document.getElementById('freq-body');
  tbody.innerHTML = '<tr><td colspan="3" class="loading">Загрузка...</td></tr>';
  try {
    var resp = await fetch(API + '/collatz/frequency?limit=30');
    var data = await resp.json();
    if (!data.frequencies || data.frequencies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="loading">Нет данных. Выполните вычисление.</td></tr>';
      return;
    }
    tbody.innerHTML = data.frequencies.map(function(f) {
      return '<tr><td>' + f.value + '</td><td>' + f.occurrence_count + '</td><td>' + f.parity + '</td></tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="error-msg">' + err.message + '</td></tr>';
  }
}

// ---- History ----
async function loadHistory() {
  var el = document.getElementById('history-list');
  el.innerHTML = '<div class="loading">Загрузка...</div>';
  try {
    var resp = await fetch(API + '/collatz/runs?limit=20');
    var data = await resp.json();
    if (!data.runs || data.runs.length === 0) {
      el.innerHTML = '<div class="loading">Нет запусков</div>';
      return;
    }
    el.innerHTML = data.runs.map(function(r) {
      return '<div class="history-item" onclick="loadRun(' + r.id + ')">' +
        '<span>n=' + r.start_number + '</span>' +
        '<span>' + r.total_steps + ' шагов</span>' +
        '<span>max=' + r.max_value + '</span>' +
        '<span>' + (r.reached_one ? 'да' : 'нет') + '</span></div>';
    }).join('');
  } catch (err) {
    el.innerHTML = '<div class="error-msg">' + err.message + '</div>';
  }
}

// ---- Load saved run ----
async function loadRun(runId) {
  try {
    var resp = await fetch(API + '/collatz/run/' + runId);
    var data = await resp.json();
    if (data.error) return;

    var seq = data.steps.map(function(s) {
      return { step: s.step_number, value: s.value, operation: s.operation };
    });

    currentSequence = seq;
    displaySequence(seq);
    drawChart(seq);
    setStat('st-number', data.run.start_number);
    setStat('st-steps', data.run.total_steps);
    setStat('st-max', data.run.max_value);
    setStat('st-current', seq[seq.length - 1].value);
    setStatus(data.run.reached_one ? 'Достигнуто 1' : 'Прервано', data.run.reached_one ? 'var(--success)' : 'var(--primary)');

    if (seq.length <= 5000) buildTree(seq);
    else buildTree(seq.slice(0, 200));
  } catch (err) {
    console.error(err);
  }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', function() {
  fetch(API + '/health')
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.status === 'ok') setStatus('Готов', 'var(--success)'); })
    .catch(function() { setStatus('Нет связи с сервером', 'var(--danger)'); });
});
