/* ══════════════════════════════════════════════════════════════
   ReflectDev Dashboard — Client-side JavaScript
   Runs inside the WebView (browser sandbox)
   ══════════════════════════════════════════════════════════════ */

// @ts-nocheck — This file runs in webview, not Node.js

(function () {
  'use strict';

  // Acquire VS Code API handle (only call once)
  const vscode = acquireVsCodeApi();

  // Chart instances (for cleanup on re-render)
  let radarChartInstance = null;
  let timelineChartInstance = null;

  // ─── Score color helpers ──────────────────────────────────

  function getScoreColor(score) {
    if (score > 70) return '#22C55E';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  }

  function getScoreClass(score) {
    if (score > 70) return 'high';
    if (score >= 40) return 'mid';
    return 'low';
  }

  function getLevelLabel(level) {
    var labels = {
      novice: '🔴 Novice',
      beginner: '🟠 Beginner',
      intermediate: '🟡 Intermediate',
      proficient: '🟢 Proficient',
      expert: '🏆 Expert'
    };
    return labels[level] || level;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  // ─── Score Ring Renderer ──────────────────────────────────

  function renderScoreRing(score, level) {
    var ring = document.getElementById('scoreRing');
    var scoreText = document.getElementById('overallScore');
    var levelText = document.getElementById('scoreLevel');

    if (!ring || !scoreText || !levelText) return;

    var circumference = 2 * Math.PI * 70; // radius = 70
    var offset = circumference - (score / 100) * circumference;
    var color = getScoreColor(score);
    var colorClass = getScoreClass(score);

    // Animate the ring
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);

    // Remove previous color classes
    ring.classList.remove('rd-ring-high', 'rd-ring-mid', 'rd-ring-low');
    ring.classList.add('rd-ring-' + colorClass);

    scoreText.classList.remove('rd-score-high', 'rd-score-mid', 'rd-score-low');
    scoreText.classList.add('rd-score-' + colorClass);

    // Trigger animation after a frame
    requestAnimationFrame(function () {
      ring.style.strokeDashoffset = String(offset);
    });

    // Animate number count-up
    animateNumber(scoreText, 0, score, 1200);
    levelText.textContent = getLevelLabel(level);
  }

  function animateNumber(element, from, to, duration) {
    var start = performance.now();
    var range = to - from;

    function tick(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(from + range * eased);
      element.textContent = String(current);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  // ─── Breakdown Cards Renderer ─────────────────────────────

  function renderBreakdownCards(data) {
    setMetric('knowledgeScore', 'knowledgeBar', 'knowledgeCard', data.knowledge.overall);
    setMetric('promptScore', 'promptBar', 'promptCard', data.promptQuality.overallScore);
    setMetric('tokenScore', 'tokenBar', 'tokenCard', data.tokenEfficiency.efficiencyPercent);
    setMetric('depthScore', 'depthBar', 'depthCard', data.knowledge.conceptualDepth);
  }

  function setMetric(valueId, barId, cardId, score) {
    var valueEl = document.getElementById(valueId);
    var barEl = document.getElementById(barId);

    if (valueEl) {
      // For token card, preserve the % unit
      if (valueId === 'tokenScore') {
        valueEl.innerHTML = String(score) + '<span class="rd-metric-unit">%</span>';
      } else {
        valueEl.textContent = String(score);
      }
    }

    if (barEl) {
      var color = getScoreColor(score);
      barEl.style.width = score + '%';
      barEl.style.background = color;
    }
  }

  // ─── Recommendations Renderer ─────────────────────────────

  function renderRecommendations(recommendations) {
    var container = document.getElementById('recsList');
    if (!container) return;

    if (!recommendations || recommendations.length === 0) {
      container.innerHTML = '<div class="rd-empty-state">Import sessions to see recommendations</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < recommendations.length && i < 5; i++) {
      var rec = recommendations[i];
      var effortClass = 'rd-effort-' + rec.effort;

      html += '<div class="rd-rec-item">'
        + '<div class="rd-rec-rank">' + rec.rank + '</div>'
        + '<div class="rd-rec-content">'
        + '<div class="rd-rec-title">' + escapeHtml(rec.title) + '</div>'
        + '<div class="rd-rec-description">' + escapeHtml(rec.description) + '</div>'
        + '</div>'
        + '<span class="rd-rec-effort ' + effortClass + '">' + rec.effort + '</span>'
        + '</div>';
    }

    container.innerHTML = html;
  }

  // ─── Radar Chart (Technology) ─────────────────────────────

  function renderRadarChart(technologies) {
    var canvas = document.getElementById('radarChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Destroy previous instance
    if (radarChartInstance) {
      radarChartInstance.destroy();
      radarChartInstance = null;
    }

    if (!technologies || technologies.length === 0) {
      var ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--vscode-descriptionForeground') || '#8b8b8b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No technology data yet', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    var labels = technologies.map(function (t) { return t.technology; });
    var scores = technologies.map(function (t) { return t.score; });

    var fg = getComputedStyle(document.body).getPropertyValue('--vscode-foreground') || '#cccccc';
    var muted = getComputedStyle(document.body).getPropertyValue('--vscode-descriptionForeground') || '#8b8b8b';
    var border = getComputedStyle(document.body).getPropertyValue('--vscode-panel-border') || '#333333';

    radarChartInstance = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Technology Score',
          data: scores,
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          borderColor: '#22C55E',
          borderWidth: 2,
          pointBackgroundColor: '#22C55E',
          pointBorderColor: '#22C55E',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              color: muted,
              backdropColor: 'transparent',
              font: { size: 10 }
            },
            grid: {
              color: border,
              lineWidth: 1
            },
            angleLines: {
              color: border,
              lineWidth: 1
            },
            pointLabels: {
              color: fg,
              font: { size: 11, weight: '500' }
            }
          }
        }
      }
    });
  }

  // ─── Timeline Chart (Score Over Time) ─────────────────────

  function renderTimelineChart(timeline) {
    var canvas = document.getElementById('timelineChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Destroy previous instance
    if (timelineChartInstance) {
      timelineChartInstance.destroy();
      timelineChartInstance = null;
    }

    if (!timeline || timeline.length === 0) {
      var ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--vscode-descriptionForeground') || '#8b8b8b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No timeline data yet', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    var labels = timeline.map(function (t) { return t.date; });
    var scores = timeline.map(function (t) { return t.score; });

    var fg = getComputedStyle(document.body).getPropertyValue('--vscode-foreground') || '#cccccc';
    var muted = getComputedStyle(document.body).getPropertyValue('--vscode-descriptionForeground') || '#8b8b8b';
    var border = getComputedStyle(document.body).getPropertyValue('--vscode-panel-border') || '#333333';

    timelineChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Overall Score',
          data: scores,
          borderColor: '#22C55E',
          backgroundColor: function (context) {
            var chart = context.chart;
            var ctx2 = chart.ctx;
            var area = chart.chartArea;
            if (!area) return 'rgba(34, 197, 94, 0.1)';

            var gradient = ctx2.createLinearGradient(0, area.top, 0, area.bottom);
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.02)');
            return gradient;
          },
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#22C55E',
          pointBorderColor: '#22C55E',
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: {
              color: muted,
              font: { size: 10 },
              maxTicksLimit: 8,
              maxRotation: 0
            },
            grid: {
              color: border,
              lineWidth: 0.5
            }
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: muted,
              font: { size: 10 },
              stepSize: 25
            },
            grid: {
              color: border,
              lineWidth: 0.5
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  // ─── Token Usage Bar ──────────────────────────────────────

  function renderTokenUsage(tokenEfficiency) {
    var total = tokenEfficiency.totalTokens || 1;

    setElement('totalTokens', formatNumber(tokenEfficiency.totalTokens));
    setElement('totalCost', '$' + tokenEfficiency.estimatedCostUSD.toFixed(4));
    setElement('efficiency', tokenEfficiency.efficiencyPercent + '%');

    setElement('inputTokens', formatNumber(tokenEfficiency.inputTokens));
    setElement('outputTokens', formatNumber(tokenEfficiency.outputTokens));
    setElement('wastedTokens', formatNumber(tokenEfficiency.wastedTokens));

    setBarWidth('inputBar', (tokenEfficiency.inputTokens / total) * 100);
    setBarWidth('outputBar', (tokenEfficiency.outputTokens / total) * 100);
    setBarWidth('wasteBar', (tokenEfficiency.wastedTokens / total) * 100);
  }

  function setBarWidth(id, percent) {
    var el = document.getElementById(id);
    if (el) {
      el.style.width = Math.max(1, Math.min(100, percent)) + '%';
    }
  }

  function setElement(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  // ─── Session Table Renderer ───────────────────────────────

  function renderSessionTable(sessions) {
    var tbody = document.getElementById('sessionsTableBody');
    if (!tbody) return;

    if (!sessions || sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="rd-empty-cell">No sessions yet — import your chat history</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var scoreClass = getScoreClass(s.score);

      var techBadges = '';
      if (s.technologies && s.technologies.length > 0) {
        for (var j = 0; j < s.technologies.length && j < 3; j++) {
          techBadges += '<span class="rd-tech-badge">' + escapeHtml(s.technologies[j]) + '</span>';
        }
        if (s.technologies.length > 3) {
          techBadges += '<span class="rd-tech-badge">+' + (s.technologies.length - 3) + '</span>';
        }
      }

      html += '<tr>'
        + '<td>' + escapeHtml(s.date) + '</td>'
        + '<td>' + escapeHtml(s.source) + '</td>'
        + '<td>' + s.messages + '</td>'
        + '<td><span class="rd-score-badge rd-score-badge-' + scoreClass + '">' + s.score + '</span></td>'
        + '<td>' + formatNumber(s.tokens) + '</td>'
        + '<td>$' + s.cost.toFixed(4) + '</td>'
        + '<td><div class="rd-tech-badges">' + techBadges + '</div></td>'
        + '</tr>';
    }

    tbody.innerHTML = html;
  }

  // ─── Main Dashboard Renderer ──────────────────────────────

  function renderDashboard(payload) {
    if (!payload) return;

    // Header session count
    setElement('sessionCount', payload.totalSessions + ' session' + (payload.totalSessions !== 1 ? 's' : ''));

    // Score ring
    renderScoreRing(payload.overallScore, payload.level);

    // Breakdown cards
    renderBreakdownCards(payload);

    // Recommendations
    renderRecommendations(payload.recommendations);

    // Charts
    renderRadarChart(payload.technologies);
    renderTimelineChart(payload.timeline);

    // Token usage
    renderTokenUsage(payload.tokenEfficiency);

    // Session table
    renderSessionTable(payload.sessions);
  }

  // ─── Utility ──────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Event Listeners ─────────────────────────────────────

  // Listen for messages from the extension
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (message && message.type === 'scoreData') {
      renderDashboard(message.payload);
    }
  });

  // Button handlers
  document.addEventListener('DOMContentLoaded', function () {
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        vscode.postMessage({ type: 'refresh' });
      });
    }

    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        vscode.postMessage({ type: 'exportReport' });
      });
    }
  });

  // Request initial data from extension
  vscode.postMessage({ type: 'requestData' });

})();
