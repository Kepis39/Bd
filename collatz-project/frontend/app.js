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

  var startNum = seq.at(0).value;

  // 1. Собираем шаги основной последовательности
  var stepMap = new Map();
  seq.forEach(function(s) {
    if (!stepMap.has(s.value)) {
      stepMap.set(s.value, Array.of());
    }
    stepMap.get(s.value).push({ step: s.step, op: s.operation });
  });

  // 2. Прямая цепочка Коллатца сверху вниз: от стартового числа до 1 (без цикла 4-2-1)
  var mainChain = Array.of();
  for (var i = 0; i < seq.length; i++) {
    var val = seq.at(i).value;
    mainChain.push(val);
    if (val === 1) break;
  }

  var tail = mainChain.at(-1);
  var guard = 0;
  while (tail > 1 && guard < 10000) {
    tail = (tail % 2 === 0) ? (tail / 2) : (tail * 3 + 1);
    mainChain.push(tail);
    if (!stepMap.has(tail)) {
      stepMap.set(tail, Array.of({ step: '…', op: 'к 1' }));
    }
    if (tail === 1) break;
    guard++;
  }

  // 3. Строим ствол дерева СВЕРХУ ВНИЗ (корень наверху — исходное число, финал внизу — 1)
  var usedValues = new Set(mainChain);
  var totalNodes = 0;
  var maxNodesLimit = 220;

  function createNode(val, inSeq, ruleLabel) {
    totalNodes++;
    return {
      value: val,
      inSequence: Boolean(inSeq),
      ruleLabel: ruleLabel || '',
      steps: stepMap.get(val) || Array.of(),
      children: Array.of()
    };
  }

  var root = createNode(mainChain.at(0), true, 'старт');
  var trunkNodes = Array.of(root);
  var currentParent = root;

  for (var k = 1; k < mainChain.length; k++) {
    var prevVal = mainChain.at(k - 1);
    var nextVal = mainChain.at(k);
    if (nextVal === prevVal) continue;

    var rule = (prevVal % 2 === 0) ? 'n/2' : '3n+1';
    var nextNode = createNode(nextVal, true, rule);
    currentParent.children.push(nextNode);
    trunkNodes.push(nextNode);
    currentParent = nextNode;
  }

  // 4. Ветвление строго по теореме Коллатца:
  // В четные узлы могут сходиться траектории от 2n и (при n ≡ 4 mod 6) от нечетного (n - 1) / 3
  var maxSideDepth = mainChain.length > 50 ? 2 : 3;

  function expandCollatzBranches(node, depth) {
    if (depth >= maxSideDepth || totalNodes >= maxNodesLimit) return;
    if (node.value <= 1) return;

    var n = node.value;
    var branches = Array.of();

    // Обратный нечетный шаг Коллатца: (n - 1) / 3, если результат целый, нечетный и > 1
    if (n > 4 && (n - 1) % 3 === 0) {
      var oddPred = (n - 1) / 3;
      if (oddPred > 1 && oddPred % 2 === 1 && !usedValues.has(oddPred)) {
        branches.push({ val: oddPred, label: '(n-1)/3' });
      }
    }

    // Обратный четный шаг Коллатца: 2n
    var evenPred = n * 2;
    if (!usedValues.has(evenPred)) {
      branches.push({ val: evenPred, label: '2n' });
    }

    branches.forEach(function(b) {
      if (totalNodes >= maxNodesLimit || usedValues.has(b.val)) return;
      usedValues.add(b.val);
      var sideNode = createNode(b.val, false, b.label);
      node.children.push(sideNode);
      expandCollatzBranches(sideNode, depth + 1);
    });
  }

  trunkNodes.forEach(function(tNode) {
    expandCollatzBranches(tNode, 0);
  });

  // 5. Иерархия и раскладка D3 сверху вниз
  var hierarchy = d3.hierarchy(root);
  var dx = 92; // Расстояние между прямоугольными боксами по ширине
  var dy = 74; // Расстояние между уровнями по высоте
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
  var svgHeight = 640;

  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;';
  hint.innerHTML =
    '<span>Сверху вниз по Коллатцу: <b>' + startNum + ' → 1</b> (синие: <b>n/2</b>, красные: <b>3n+1</b>, боковые ветви: <b>2n</b> и <b>(n−1)/3</b>)</span>' +
    '<button type="button" id="btn-fit-tree" style="padding:3px 10px;font-size:12px;cursor:pointer;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;">Показать всё дерево</button>';
  container.appendChild(hint);

  var svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', svgHeight)
    .style('background', '#ffffff')
    .style('border', '1px solid #e2e8f0')
    .style('border-radius', '8px')
    .style('cursor', 'grab');

  // Цветные стрелки на концах линий
  var defs = svg.append('defs');
  var arrowDefs = Array.of(
    { id: 'box-arr-even', color: '#2563eb' },
    { id: 'box-arr-odd',  color: '#ef4444' },
    { id: 'box-arr-side', color: '#94a3b8' }
  );

  arrowDefs.forEach(function(m) {
    defs.append('marker')
      .attr('id', m.id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', m.color);
  });

  var g = svg.append('g');

  var zoom = d3.zoom()
    .scaleExtent(Array.of(0.03, 3.5))
    .on('zoom', function(event) {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);

  var boxH = 28;
  function getBoxW(val) {
    return Math.max(48, String(val).length * 9 + 20);
  }

  // 6. Отрисовка связей от нижней грани верхнего бокса к верхней грани нижнего бокса
  g.selectAll('.tree-link')
    .data(hierarchy.links())
    .enter()
    .append('path')
    .attr('class', 'tree-link')
    .attr('fill', 'none')
    .attr('stroke', function(d) {
      var isMain = d.source.data.inSequence && d.target.data.inSequence;
      if (!isMain) return '#94a3b8';
      return (d.source.data.value % 2 === 0) ? '#2563eb' : '#ef4444';
    })
    .attr('stroke-dasharray', function(d) {
      var isMain = d.source.data.inSequence && d.target.data.inSequence;
      return isMain ? 'none' : '4,3';
    })
    .attr('stroke-width', function(d) {
      return (d.source.data.inSequence && d.target.data.inSequence) ? 2.2 : 1.4;
    })
    .attr('marker-end', function(d) {
      var isMain = d.source.data.inSequence && d.target.data.inSequence;
      if (!isMain) return 'url(#box-arr-side)';
      return (d.source.data.value % 2 === 0) ? 'url(#box-arr-even)' : 'url(#box-arr-odd)';
    })
    .attr('d', function(d) {
      var sx = d.source.x;
      var sy = d.source.y + (boxH / 2);
      var tx = d.target.x;
      var ty = d.target.y - (boxH / 2) - 2;
      var midY = (sy + ty) / 2;
      return 'M' + sx + ',' + sy + ' C' + sx + ',' + midY + ' ' + tx + ',' + midY + ' ' + tx + ',' + ty;
    });

  // 7. Отрисовка прямоугольных цветных боксов
  var nodes = g.selectAll('.tree-node')
    .data(hierarchy.descendants())
    .enter()
    .append('g')
    .attr('class', 'tree-node')
    .attr('transform', function(d) {
      return 'translate(' + d.x + ',' + d.y + ')';
    });

  nodes.append('rect')
    .attr('x', function(d) { return -getBoxW(d.data.value) / 2; })
    .attr('y', -boxH / 2)
    .attr('width', function(d) { return getBoxW(d.data.value); })
    .attr('height', boxH)
    .attr('rx', 6)
    .attr('ry', 6)
    .attr('fill', function(d) {
      if (d.depth === 0) return '#f59e0b';                          // Старт наверху — оранжевый
      if (d.data.value === 1 && d.data.inSequence) return '#16a34a'; // Финиш 1 внизу — зеленый
      if (d.data.inSequence) {
        return (d.data.value % 2 === 0) ? '#2563eb' : '#ef4444';    // Четные — синие, нечетные — красные
      }
      return (d.data.value % 2 === 0) ? '#eff6ff' : '#fef2f2';      // Боковые ветви — светлые пастельные
    })
    .attr('stroke', function(d) {
      if (d.depth === 0) return '#b45309';
      if (d.data.value === 1 && d.data.inSequence) return '#15803d';
      if (d.data.inSequence) {
        return (d.data.value % 2 === 0) ? '#1d4ed8' : '#b91c1c';
      }
      return (d.data.value % 2 === 0) ? '#93c5fd' : '#fca5a5';
    })
    .attr('stroke-width', function(d) { return d.data.inSequence ? 2 : 1.3; });

  nodes.append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .style('font-family', 'Segoe UI, system-ui, sans-serif')
    .style('font-size', '12px')
    .style('font-weight', function(d) { return d.data.inSequence ? '700' : '600'; })
    .style('fill', function(d) {
      return d.data.inSequence ? '#ffffff' : '#334155';
    })
    .text(function(d) { return d.data.value; });

  nodes.append('title')
    .text(function(d) {
      if (!d.data.inSequence) {
        return 'Ветвь Коллатца (' + d.data.ruleLabel + '): ' + d.data.value;
      }
      var stepsStr = d.data.steps.map(function(st) {
        return st.step === '…' ? '…' : '#' + st.step + ' (' + st.op + ')';
      }).join(', ');
      return 'Число: ' + d.data.value + '\nШаги: ' + stepsStr;
    });

  // 8. Автоматическое вписывание всего дерева в экран
  function fitFullTree() {
    var currentViewW = container.clientWidth || viewWidth;
    var treeW = Math.max(140, (maxX - minX) + 180);
    var treeH = Math.max(140, (maxY - minY) + 150);
    var scale = Math.min(currentViewW / treeW, svgHeight / treeH, 1.1);
    scale = Math.max(scale, 0.04);

    var centerX = (minX + maxX) / 2;
    var centerY = (minY + maxY) / 2;

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
