/* ============================================================
   Collatz Conjecture — Frontend Logic (app.js)
   ============================================================ */

const API = '/api';
let chartInstance = null;
let isRunning = false;
let currentSequence = Array.of();

function toggleTheory() {
  const el = document.getElementById('theory-section');
  if (el) el.classList.toggle('collapsed');
}

function setStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setStatus(text, color) {
  const el = document.getElementById('st-status');
  if (el) {
    el.textContent = text;
    el.style.color = color || 'var(--primary)';
  }
}

// ---- Start ----
async function startComputation() {
  const num = parseInt(document.getElementById('input-number').value, 10);
  const mode = document.getElementById('mode-select').value;
  const maxSteps = parseInt(document.getElementById('max-steps').value, 10) || 10000;

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

    currentSequence = data.sequence || Array.of();
    displaySequence(currentSequence);
    drawChart(currentSequence);
    setStat('st-steps', data.total_steps);
    setStat('st-max', data.max_value);
    setStat('st-current', 1);
    setStatus('Достигнуто 1', 'var(--success)');
    buildTree(currentSequence);
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

  currentSequence = Array.of();
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

  if (currentSequence.length > 0) {
    var chartSeq = currentSequence.length <= 5000 ? currentSequence : currentSequence.slice(0, 5000);
    drawChart(chartSeq);
    buildTree(currentSequence);
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
  var canvas = document.getElementById('chart-canvas');
  if (!canvas || typeof Chart === 'undefined') return;
  var ctx = canvas.getContext('2d');
  if (chartInstance) chartInstance.destroy();

  var labels = seq.map(function(s) { return s.step; });
  var values = seq.map(function(s) { return s.value; });

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: Array.of({
        label: 'Значение',
        data: values,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 1.5,
        pointRadius: seq.length > 100 ? 0 : 2,
        fill: true,
        tension: 0.1
      })
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

// ---- Tree (D3.js) — Полное дерево со всеми шагами и авто-вписыванием в экран ----
function buildTree(seq) {
  var container = document.getElementById('tree-container');
  if (!container || typeof d3 === 'undefined') return;
  container.innerHTML = '';

  if (!seq || seq.length === 0) return;

  // 1. Собираем все шаги вычисленной последовательности
  var stepMap = new Map();
  seq.forEach(function(s) {
    if (!stepMap.has(s.value)) {
      stepMap.set(s.value, Array.of());
    }
    stepMap.get(s.value).push({ step: s.step, op: s.operation });
  });

  // 2. Формируем непрерывную цепочку от стартового числа до корня 1
  var fullChain = seq.map(function(s) { return s.value; });
  var lastVal = fullChain.at(-1);
  var guard = 0;
  while (lastVal > 1 && guard < 10000) {
    lastVal = (lastVal % 2 === 0) ? (lastVal / 2) : (lastVal * 3 + 1);
    fullChain.push(lastVal);
    if (!stepMap.has(lastVal)) {
      stepMap.set(lastVal, Array.of({ step: '…', op: 'к 1' }));
    }
    guard++;
  }

  // 3. Строим гарантированный основной ствол от корня 1 ко всем шагам
  var nodeMap = new Map();

  function getOrCreateMainNode(val) {
    if (!nodeMap.has(val)) {
      nodeMap.set(val, {
        value: val,
        inSequence: stepMap.has(val),
        steps: stepMap.get(val) || Array.of(),
        children: Array.of()
      });
    }
    return nodeMap.get(val);
  }

  var root = getOrCreateMainNode(1);

  function containsNode(subRoot, val) {
    if (subRoot.value === val) return true;
    return subRoot.children.some(function(c) { return containsNode(c, val); });
  }

  function hasAncestor(targetNode, checkVal, currentRoot) {
    if (currentRoot.value === checkVal) {
      return containsNode(currentRoot, targetNode.value);
    }
    for (var k = 0; k < currentRoot.children.length; k++) {
      if (hasAncestor(targetNode, checkVal, currentRoot.children.at(k))) return true;
    }
    return false;
  }

  // Связываем все узлы от 1 до начального числа без потерь и циклов
  for (var i = fullChain.length - 1; i > 0; i--) {
    var currVal = fullChain.at(i);
    var prevVal = fullChain.at(i - 1);
    if (currVal === prevVal) continue;
    if (currVal === 4 && prevVal === 1) continue;

    var parentNode = getOrCreateMainNode(currVal);
    var childNode = getOrCreateMainNode(prevVal);

    var alreadyLinked = parentNode.children.some(function(ch) { return ch.value === prevVal; });
    if (!alreadyLinked && !hasAncestor(parentNode, prevVal, root)) {
      parentNode.children.push(childNode);
    }
  }

  // 4. Добавляем боковые ветки для контекста дерева
  var maxSideDepth = seq.length > 60 ? 1 : 2;

  function addSideBranches(node, sideDepth) {
    if (sideDepth >= maxSideDepth) return;

    var c1 = node.value * 2;
    if (!nodeMap.has(c1)) {
      var side1 = { value: c1, inSequence: false, steps: Array.of(), children: Array.of() };
      nodeMap.set(c1, side1);
      node.children.push(side1);
      addSideBranches(side1, sideDepth + 1);
    }

    if (node.value > 1 && (node.value - 1) % 3 === 0) {
      var c2 = (node.value - 1) / 3;
      if (c2 > 0 && c2 % 2 === 1 && !nodeMap.has(c2)) {
        var side2 = { value: c2, inSequence: false, steps: Array.of(), children: Array.of() };
        nodeMap.set(c2, side2);
        node.children.push(side2);
        addSideBranches(side2, sideDepth + 1);
      }
    }
  }

  var mainNodesList = Array.from(nodeMap.values());
  mainNodesList.forEach(function(mNode) {
    addSideBranches(mNode, 0);
  });

  // 5. Раскладка с фиксированным интервалом между узлами
  var hierarchy = d3.hierarchy(root);
  var dx = 48;
  var dy = 115;
  var treeLayout = d3.tree().nodeSize(Array.of(dx, dy));
  treeLayout(hierarchy);

  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  hierarchy.each(function(d) {
    if (d.x < minX) minX = d.x;
    if (d.x > maxX) maxX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.y > maxY) maxY = d.y;
  });

  var viewWidth = container.clientWidth || 960;
  var svgHeight = 620;

  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;';
  hint.innerHTML = '<span>Колёсико мыши — масштаб, ЛКМ — перемещение (всего шагов: ' + seq.length + ')</span>' +
                   '<button type="button" id="btn-fit-tree" style="padding:3px 10px;font-size:12px;cursor:pointer;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;">Показать всё дерево</button>';
  container.appendChild(hint);

  var svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', svgHeight)
    .style('background', '#f8fafc')
    .style('border-radius', '8px')
    .style('cursor', 'grab');

  var g = svg.append('g');

  var zoom = d3.zoom()
    .scaleExtent(Array.of(0.03, 3.5))
    .on('zoom', function(event) {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);

  var startNum = seq.at(0).value;

  g.selectAll('.tree-link')
    .data(hierarchy.links())
    .enter()
    .append('path')
    .attr('class', 'tree-link')
    .attr('fill', 'none')
    .attr('stroke', function(d) {
      return (d.source.data.inSequence && d.target.data.inSequence) ? '#2563eb' : '#cbd5e1';
    })
    .attr('stroke-width', function(d) {
      return (d.source.data.inSequence && d.target.data.inSequence) ? 3 : 1.2;
    })
    .attr('d', d3.linkHorizontal()
      .x(function(d) { return d.y; })
      .y(function(d) { return d.x; })
    );

  var nodes = g.selectAll('.tree-node')
    .data(hierarchy.descendants())
    .enter()
    .append('g')
    .attr('class', 'tree-node')
    .attr('transform', function(d) {
      return 'translate(' + d.y + ',' + d.x + ')';
    });

  nodes.append('circle')
    .attr('r', function(d) { return d.data.inSequence ? 7.5 : 4; })
    .attr('fill', function(d) {
      if (d.data.value === startNum) return '#dc2626';
      if (d.data.value === 1) return '#16a34a';
      return d.data.inSequence ? '#2563eb' : '#94a3b8';
    })
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5);

  nodes.append('text')
    .attr('dy', function(d) { return d.data.inSequence ? '-0.8em' : '0.32em'; })
    .attr('x', function(d) { return d.data.inSequence ? 0 : (d.children ? -8 : 8); })
    .attr('text-anchor', function(d) {
      if (d.data.inSequence) return 'middle';
      return d.children ? 'end' : 'start';
    })
    .style('font-size', function(d) { return d.data.inSequence ? '13px' : '10px'; })
    .style('font-weight', function(d) { return d.data.inSequence ? '700' : '400'; })
    .style('fill', function(d) { return d.data.inSequence ? '#0f172a' : '#94a3b8'; })
    .text(function(d) { return d.data.value; });

  nodes.filter(function(d) { return d.data.inSequence; })
    .append('text')
    .attr('dy', '1.6em')
    .attr('x', 0)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .style('fill', '#2563eb')
    .text(function(d) {
      var labels = d.data.steps.map(function(st) {
        if (st.step === '…') return '…';
        return '#' + st.step + (st.op === 'start' ? ' (старт)' : ' (' + st.op + ')');
      });
      if (labels.length > 3) {
        return labels.at(0) + ', ' + labels.at(1) + ' … ' + labels.at(-1);
      }
      return labels.join(', ');
    });

  // 6. Автоматическое масштабирование всего дерева целиком под ширину и высоту окна
  function fitFullTree() {
    var currentViewW = container.clientWidth || viewWidth;
    var treeW = (maxY - minY) + 160;
    var treeH = (maxX - minX) + 120;
    var scaleX = currentViewW / treeW;
    var scaleY = svgHeight / treeH;
    var scale = Math.min(scaleX, scaleY, 1.1);
    scale = Math.max(scale, 0.04);

    var centerX = (minY + maxY) / 2;
    var centerY = (minX + maxX) / 2;

    var translateX = (currentViewW / 2) - (centerX * scale);
    var translateY = (svgHeight / 2) - (centerY * scale);

    svg.transition().duration(350).call(
      zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );
  }

  fitFullTree();
  var fitBtn = document.getElementById('btn-fit-tree');
  if (fitBtn) fitBtn.onclick = fitFullTree;
}

// ---- Frequency (кнопка «Частоты» -> #freq-body) ----
async function loadFrequency() {
  var tbody = document.getElementById('freq-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="loading">Загрузка частот...</td></tr>';

  var endpoints = Array.of(
    API + '/collatz/frequency',
    API + '/collatz/frequencies',
    API + '/frequency',
    API + '/frequencies'
  );
  var serverItems = null;

  for (var i = 0; i < endpoints.length; i++) {
    try {
      var resp = await fetch(endpoints.at(i));
      if (resp.ok) {
        var data = await resp.json();
        var arr = Array.isArray(data)
          ? data
          : (data.frequency || data.frequencies || data.numbers || data.items || data.data || data.rows || null);
        if (arr && arr.length > 0) {
          serverItems = arr;
          break;
        }
      }
    } catch (e) {}
  }

  if (serverItems) {
    renderFrequencyRows(tbody, serverItems);
    tbody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (currentSequence && currentSequence.length > 0) {
    var counts = new Map();
    currentSequence.forEach(function(s) {
      counts.set(s.value, (counts.get(s.value) || 0) + 1);
    });
    var localItems = Array.from(counts.entries())
      .map(function(entry) { return { value: entry.at(0), count: entry.at(1) }; })
      .sort(function(a, b) { return b.count - a.count || a.value - b.value; });

    renderFrequencyRows(tbody, localItems);
    tbody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Нет данных (сначала запустите вычисление)</td></tr>';
  }
}

function renderFrequencyRows(tbody, items) {
  tbody.innerHTML = items.map(function(item) {
    var val, cnt;

    if (Array.isArray(item)) {
      val = item.at(0);
      cnt = item.at(1);
    } else {
      val = item.value ?? item.number ?? item.num ?? item.val ?? item.n;
      cnt = item.count ?? item.times ?? item.times_seen ?? item.seen ??
            item.cnt ?? item.total ?? item.freq ?? item.frequency ??
            item.occurrences ?? item.hits ?? item.repeats ?? item.appearances;

      if (cnt === undefined) {
        Object.keys(item).forEach(function(k) {
          var kLow = k.toLowerCase();
          if (kLow !== 'id' && kLow !== 'is_even' && kLow !== 'even' && kLow !== 'parity' && String(item[k]) !== String(val) && cnt === undefined) {
            var parsed = Number(item[k]);
            if (!Number.isNaN(parsed)) cnt = parsed;
          }
        });
      }
    }

    if (cnt === undefined) cnt = 1;

    // Строгое математическое определение чётности самого числа
    var cleanVal = String(val).trim();
    var isEven = false;
    try {
      isEven = (BigInt(cleanVal) % 2n === 0n);
    } catch (e) {
      isEven = (Number(cleanVal) % 2 === 0);
    }
    var parity = isEven ? 'Чётное' : 'Нечётное';

    return '<tr><td><strong>' + val + '</strong></td><td>' + cnt + '</td><td>' + parity + '</td></tr>';
  }).join('');
}

// ---- History (кнопка «История» -> #history-list) ----
async function loadHistory() {
  var container = document.getElementById('history-list');
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка истории...</div>';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  var urls = Array.of(
    API + '/collatz/history',
    API + '/history',
    API + '/collatz/runs',
    API + '/runs'
  );

  var items = null;
  var lastErr = '';

  for (var i = 0; i < urls.length; i++) {
    try {
      var resp = await fetch(urls.at(i));
      if (resp.ok) {
        var data = await resp.json();
        var extracted = Array.isArray(data)
          ? data
          : (data.history || data.runs || data.items || data.calculations || data.data || data.records || data.rows || null);
        if (extracted !== null) {
          items = extracted;
          break;
        }
      } else {
        lastErr = 'HTTP ' + resp.status;
      }
    } catch (err) {
      lastErr = err.message;
    }
  }

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="loading">История запусков пуста' + (lastErr && items === null ? ' (' + lastErr + ')' : '') + '</div>';
    return;
  }

  container.innerHTML = items.map(function(h) {
    var num, steps, maxVal, modeRaw;

    if (Array.isArray(h)) {
      num = h.at(1) ?? h.at(0);
      steps = h.at(2) ?? 0;
      maxVal = h.at(3) ?? '—';
      modeRaw = h.at(4) ?? 'until_one';
    } else {
      num = h.number ?? h.start_number ?? h.initial_number ?? h.input_number ?? h.num ?? h.n ?? h.value;
      steps = h.total_steps ?? h.steps ?? h.step_count ?? h.steps_count ?? h.length ?? 0;
      maxVal = h.max_value ?? h.max_val ?? h.peak ?? h.maximum ?? h.max ?? '—';
      modeRaw = h.mode ?? 'until_one';
    }

    var modeLabel = (modeRaw === 'infinite') ? 'Бесконечный' : 'До 1';

    return '<div class="seq-row" style="cursor:pointer;" title="Нажмите для повторного запуска" onclick="runFromHistory(' + num + ')">' +
      '<span class="seq-step">Число <strong>' + num + '</strong></span>' +
      '<span class="seq-val">Шагов: ' + steps + ' (макс: ' + maxVal + ')</span>' +
      '<span class="seq-op">' + modeLabel + '</span>' +
    '</div>';
  }).join('');
}

function runFromHistory(num) {
  var input = document.getElementById('input-number');
  if (input && num) {
    input.value = num;
    startComputation();
  }
}
