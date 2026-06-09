/* ═══════════════════════════════════════════════════
   AM MODULATION LAB — APPLICATION LOGIC
   ═══════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ───────── DOM REFERENCES ─────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Sidebar / Mobile
  const sidebar      = $('#sidebar');
  const overlay      = $('#sidebar-overlay');
  const menuToggle   = $('#menu-toggle');
  const navBtns      = $$('.nav-btn');

  // Message controls
  const msgAmpSlider   = $('#msg-amp');
  const msgFreqSlider  = $('#msg-freq');
  const msgPhaseSlider = $('#msg-phase');
  const waveBtns       = $$('.wave-btn');

  // Carrier controls
  const carAmpSlider   = $('#car-amp');
  const carFreqSlider  = $('#car-freq');
  const carPhaseSlider = $('#car-phase');

  // Lab controls
  const labMuSlider   = $('#lab-mu');
  const labBetaSlider = $('#lab-beta');
  const labFmSlider   = $('#lab-fm');
  const labFcSlider   = $('#lab-fc');

  // FM controls
  const fmDevSlider = $('#fm-dev');

  // ───────── STATE ─────────
  const state = {
    waveType: 'sine',
    msgAmp: 1,
    msgFreq: 5,
    msgPhase: 0,
    carAmp: 3,
    carFreq: 100,
    carPhase: 0,
    fmDev: 50,
    // Lab
    labMu: 0.5,
    labBeta: 5.0,
    labFm: 5,
    labFc: 100,
  };

  // ───────── PLOTLY LAYOUT TEMPLATE ─────────
  const plotlyBg = 'rgba(0,0,0,0)';
  const gridColor = 'rgba(255,255,255,0.06)';
  const axisFont = { family: 'Inter, sans-serif', size: 11, color: '#8b8fa3' };

  function baseLayout(title, xTitle, yTitle) {
    return {
      paper_bgcolor: plotlyBg,
      plot_bgcolor: plotlyBg,
      margin: { l: 50, r: 20, t: 10, b: 40 },
      xaxis: {
        title: { text: xTitle, font: axisFont },
        gridcolor: gridColor,
        zerolinecolor: 'rgba(255,255,255,0.12)',
        tickfont: axisFont,
      },
      yaxis: {
        title: { text: yTitle, font: axisFont },
        gridcolor: gridColor,
        zerolinecolor: 'rgba(255,255,255,0.12)',
        tickfont: axisFont,
      },
      showlegend: false,
      dragmode: 'zoom',
    };
  }

  const plotlyConfig = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
    toImageButtonOptions: {
      format: 'jpeg',
      filename: 'am_lab_graph',
      height: 600,
      width: 1000,
      scale: 2,
    },
  };

  // ───────── WAVEFORM GENERATORS ─────────
  function generateWave(type, amp, freq, phase, t) {
    const w = 2 * Math.PI * freq;
    const phi = (phase * Math.PI) / 180;
    switch (type) {
      case 'sine':
        return amp * Math.sin(w * t + phi);
      case 'square': {
        const val = Math.sin(w * t + phi);
        return amp * (val >= 0 ? 1 : -1);
      }
      case 'triangle': {
        const period = 1 / freq;
        const tShifted = t + (phi / (2 * Math.PI)) * period;
        const normalized = ((tShifted % period) + period) % period;
        const half = period / 2;
        if (normalized < half) {
          return amp * (2 * normalized / half - 1);
        } else {
          return amp * (1 - 2 * (normalized - half) / half);
        }
      }
      default:
        return 0;
    }
  }

  // Generate time array
  function timeArray(duration, sampleRate) {
    const n = Math.round(duration * sampleRate);
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) arr[i] = i / sampleRate;
    return arr;
  }

  // Bessel function of the first kind J_n(beta) using numerical integration
  // J_n(beta) = (1/pi) * integral_0^pi cos(n*theta - beta*sin(theta)) d_theta
  function besselJ(n, beta) {
    const numSteps = 120; // 120 steps is extremely accurate for beta <= 20
    let sum = 0;
    for (let i = 0; i <= numSteps; i++) {
      const theta = (i * Math.PI) / numSteps;
      const term = Math.cos(n * theta - beta * Math.sin(theta));
      const weight = (i === 0 || i === numSteps) ? 0.5 : 1.0;
      sum += term * weight;
    }
    return sum / numSteps;
  }

  // ───────── SIDEBAR NAVIGATION ─────────
  function initNavigation() {
    navBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetEl = $(`#${targetId}`);
        if (targetEl) {
          // Toggle active nav
          navBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Scroll to the section smoothly
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Close mobile sidebar
          closeSidebar();
        }
      });
    });

    // Mobile
    menuToggle.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Scroll spy with IntersectionObserver
    if ('IntersectionObserver' in window) {
      const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -50% 0px',
        threshold: 0,
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            const correspondingBtn = $(`.nav-btn[data-target="${id}"]`);
            if (correspondingBtn) {
              navBtns.forEach((b) => b.classList.remove('active'));
              correspondingBtn.classList.add('active');
            }
          }
        });
      }, observerOptions);

      $$('.section-block').forEach((section) => {
        observer.observe(section);
      });
    }
  }

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  // ───────── WAVE PICKER ─────────
  function initWavePicker() {
    waveBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        waveBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.waveType = btn.dataset.wave;
        onParamChange();
      });
    });
  }

  // ───────── SLIDER EVENTS ─────────
  function initSliders() {
    const bind = (slider, valId, stateKey, transform) => {
      const valEl = $(`#${valId}`);
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        state[stateKey] = v;
        valEl.textContent = transform ? transform(v) : v;
        updateSliderFill(slider);
        onParamChange();
      });
      updateSliderFill(slider);
    };

    bind(msgAmpSlider,   'msg-amp-val',   'msgAmp',   (v) => v.toFixed(1));
    bind(msgFreqSlider,  'msg-freq-val',  'msgFreq',  (v) => v);
    bind(msgPhaseSlider, 'msg-phase-val', 'msgPhase', (v) => v);
    bind(carAmpSlider,   'car-amp-val',   'carAmp',   (v) => v.toFixed(1));
    bind(carFreqSlider,  'car-freq-val',  'carFreq',  (v) => v);
    bind(carPhaseSlider, 'car-phase-val', 'carPhase', (v) => v);

    // Lab sliders
    bind(labMuSlider,   'lab-mu-val',   'labMu',   (v) => v.toFixed(2));
    bind(labBetaSlider, 'lab-beta-val', 'labBeta', (v) => v.toFixed(1));
    bind(labFmSlider,   'lab-fm-val',   'labFm',   (v) => v);
    bind(labFcSlider,   'lab-fc-val',   'labFc',   (v) => v);

    // FM sliders
    bind(fmDevSlider, 'fm-dev-val', 'fmDev', (v) => v);
  }

  function updateSliderFill(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    let color = 'var(--accent)';
    if (slider.classList.contains('slider-purple')) {
      color = 'var(--purple)';
    } else if (slider.classList.contains('slider-cyan')) {
      color = 'var(--cyan)';
    }
    slider.style.background = `linear-gradient(90deg, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
  }

  // ───────── ON PARAM CHANGE ─────────
  let rafId = null;
  function onParamChange() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      updateEquations();
      updateModulationStatus();
      updateCalculations();
      updateHeaderStats();
      updateMainGraphs();
      updateLabGraph();
      updateObservations();
    });
  }

  // ───────── EQUATIONS ─────────
  function updateEquations() {
    const { waveType, msgAmp, msgFreq, msgPhase, carAmp, carFreq, carPhase, fmDev } = state;
    const waveNames = { sine: 'sin', square: 'sgn(sin', triangle: 'tri(' };
    const waveClose = { sine: '', square: ')', triangle: ')' };
    const wName = waveNames[waveType];
    const wClose = waveClose[waveType];

    $('#msg-eq-body').textContent =
      `${msgAmp.toFixed(1)} ${wName}(2π · ${msgFreq}t + ${msgPhase}°${wClose})`;

    $('#car-eq-body').textContent =
      `${carAmp.toFixed(1)} cos(2π · ${carFreq}t + ${carPhase}°)`;

    const mu = msgAmp / carAmp;
    $('#am-mu-display').innerHTML =
      `μ = A<sub>m</sub> / A<sub>c</sub> = ${msgAmp.toFixed(1)} / ${carAmp.toFixed(1)} = ${mu.toFixed(3)}`;

    const beta = fmDev / msgFreq;
    const fmBW = 2 * (fmDev + msgFreq);
    $('#fm-beta-display').innerHTML =
      `β = Δf / f<sub>m</sub> = ${fmDev} / ${msgFreq} = ${beta.toFixed(2)}`;
    $('#fm-bw-display').innerHTML =
      `BW = 2(Δf + f<sub>m</sub>) = 2(${fmDev} + ${msgFreq}) = ${fmBW} Hz`;
  }

  // ───────── MODULATION STATUS ─────────
  function updateModulationStatus() {
    // AM Status
    const mu = state.msgAmp / state.carAmp;
    const dot = $('#mod-status .status-dot');
    const text = $('#mod-status-text');

    dot.className = 'status-dot';
    if (mu < 1) {
      dot.classList.add('status-normal');
      text.textContent = `Normal Modulation (μ = ${mu.toFixed(3)} < 1)`;
    } else if (Math.abs(mu - 1) < 0.005) {
      dot.classList.add('status-full');
      text.textContent = `100% Modulation (μ ≈ 1)`;
    } else {
      dot.classList.add('status-over');
      text.textContent = `Over-Modulation (μ = ${mu.toFixed(3)} > 1) — Distortion!`;
    }

    // FM Status
    const beta = state.fmDev / state.msgFreq;
    const fmDot = $('#fm-status .status-dot');
    const fmText = $('#fm-status-text');

    fmDot.className = 'status-dot';
    if (beta < 1) {
      fmDot.classList.add('status-normal');
      fmText.textContent = `Narrowband FM (β = ${beta.toFixed(2)} < 1)`;
    } else {
      fmDot.classList.add('status-wide');
      fmText.textContent = `Wideband FM (β = ${beta.toFixed(2)} ≥ 1)`;
    }
  }


  // ───────── MAIN GRAPHS ─────────
  function updateMainGraphs() {
    const { waveType, msgAmp, msgFreq, msgPhase, carAmp, carFreq, carPhase, fmDev } = state;
    const duration = 4 / msgFreq;
    const sr = Math.max(8000, carFreq * 50);
    const t = timeArray(duration, sr);
    const tArr = Array.from(t);

    const mu = msgAmp / carAmp;

    // 1. Message
    const msgY = tArr.map((ti) => generateWave(waveType, msgAmp, msgFreq, msgPhase, ti));
    plotMain('plot-message', tArr, msgY, 'var(--accent)', 'Time (s)', 'Amplitude (V)');

    // 2. Carrier
    const carY = tArr.map((ti) => generateWave('sine', carAmp, carFreq, carPhase, ti));
    plotMain('plot-carrier', tArr, carY, 'var(--purple)', 'Time (s)', 'Amplitude (V)');

    // 3. AM
    const amY = tArr.map((ti) => {
      const m = generateWave(waveType, 1, msgFreq, msgPhase, ti);
      const c = carAmp * Math.cos(2 * Math.PI * carFreq * ti + (carPhase * Math.PI) / 180);
      return (1 + mu * m) * c;
    });

    // Also plot envelope
    const envUpper = tArr.map((ti) => {
      const m = generateWave(waveType, 1, msgFreq, msgPhase, ti);
      return carAmp * (1 + mu * m);
    });
    const envLower = envUpper.map((v) => -v);

    plotMainAM('plot-am', tArr, amY, envUpper, envLower);

    // 4. AM Frequency Spectrum
    plotSpectrum('plot-am-spectrum', mu, carAmp, msgFreq, carFreq);

    // 5. FM Modulated Signal
    // Calculate the numerical integral of the normalized message signal
    let cumSum = 0;
    const dt = 1 / sr;
    const fmY = tArr.map((ti, idx) => {
      const normalizedVal = msgAmp > 0 ? (msgY[idx] / msgAmp) : 0;
      cumSum += normalizedVal * dt;
      const phase = 2 * Math.PI * carFreq * ti + 2 * Math.PI * fmDev * cumSum + (carPhase * Math.PI) / 180;
      return carAmp * Math.cos(phase);
    });
    plotMain('plot-fm', tArr, fmY, 'var(--cyan)', 'Time (s)', 'Amplitude (V)');

    // 6. FM Frequency Spectrum
    const beta = fmDev / msgFreq;
    plotFmSpectrum('plot-fm-spectrum', beta, carAmp, msgFreq, carFreq);
  }

  function plotMain(containerId, x, y, color, xTitle, yTitle) {
    const container = $(`#${containerId}`);
    if (!container) return;

    const trace = {
      x, y,
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 1.5 },
      hoverinfo: 'x+y',
    };

    const layout = baseLayout('', xTitle, yTitle);

    if (container.data) {
      Plotly.react(container, [trace], layout, plotlyConfig);
    } else {
      Plotly.newPlot(container, [trace], layout, plotlyConfig);
    }
  }

  function plotMainAM(containerId, x, y, envUp, envDown) {
    const container = $(`#${containerId}`);
    if (!container) return;

    const traces = [
      {
        x, y,
        type: 'scatter',
        mode: 'lines',
        line: { color: 'var(--green)', width: 1.5 },
        name: 'AM Signal',
        hoverinfo: 'x+y',
      },
      {
        x, y: envUp,
        type: 'scatter',
        mode: 'lines',
        line: { color: 'var(--amber)', width: 1.2, dash: 'dash' },
        name: 'Upper Envelope',
        hoverinfo: 'skip',
      },
      {
        x, y: envDown,
        type: 'scatter',
        mode: 'lines',
        line: { color: 'var(--amber)', width: 1.2, dash: 'dash' },
        name: 'Lower Envelope',
        hoverinfo: 'skip',
      },
    ];

    const layout = baseLayout('', 'Time (s)', 'Amplitude (V)');
    layout.showlegend = true;
    layout.legend = {
      font: { ...axisFont, size: 10 },
      bgcolor: 'rgba(0,0,0,0)',
      x: 1, xanchor: 'right', y: 1,
    };

    if (container.data) {
      Plotly.react(container, traces, layout, plotlyConfig);
    } else {
      Plotly.newPlot(container, traces, layout, plotlyConfig);
    }
  }

  function plotSpectrum(containerId, mu, Ac, fm, fc) {
    const container = $(`#${containerId}`);
    if (!container) return;

    // AM spectrum: carrier + two sidebands
    const carrierPower = Ac;
    const sideband = (mu * Ac) / 2;

    const freqs = [fc - fm, fc, fc + fm];
    const amps = [sideband, carrierPower, sideband];
    const labels = [
      `f<sub>c</sub>−f<sub>m</sub> = ${fc - fm} Hz`,
      `f<sub>c</sub> = ${fc} Hz`,
      `f<sub>c</sub>+f<sub>m</sub> = ${fc + fm} Hz`,
    ];

    const traceStems = {
      x: freqs,
      y: amps,
      type: 'bar',
      width: Math.max(0.5, fm * 0.25),
      marker: {
        color: ['var(--amber)', 'var(--purple)', 'var(--amber)'],
      },
      text: labels,
      hoverinfo: 'text+y',
    };

    const layout = baseLayout('', 'Frequency (Hz)', 'Amplitude');
    layout.xaxis.range = [fc - fm * 4, fc + fm * 4];
    layout.yaxis.rangemode = 'tozero';

    // Add annotations
    layout.annotations = freqs.map((f, i) => ({
      x: f,
      y: amps[i],
      text: labels[i],
      showarrow: true,
      arrowhead: 0,
      arrowcolor: 'rgba(255,255,255,0.2)',
      ax: 0,
      ay: -30,
      font: { size: 10, color: '#8b8fa3', family: 'Inter, sans-serif' },
    }));

    if (container.data) {
      Plotly.react(container, [traceStems], layout, plotlyConfig);
    } else {
      Plotly.newPlot(container, [traceStems], layout, plotlyConfig);
    }
  }

  function plotFmSpectrum(containerId, beta, Ac, fm, fc) {
    const container = $(`#${containerId}`);
    if (!container) return;

    const numSidebands = Math.max(3, Math.ceil(beta) + 3);
    const freqs = [];
    const amps = [];
    const labels = [];
    const colors = [];

    for (let n = -numSidebands; n <= numSidebands; n++) {
      const f = fc + n * fm;
      if (f < 0) continue;
      const jVal = besselJ(n, beta);
      const amp = Ac * Math.abs(jVal);

      freqs.push(f);
      amps.push(amp);
      
      const labelText = n === 0 
        ? `f<sub>c</sub> = ${fc} Hz` 
        : `f<sub>c</sub>${n > 0 ? '+' : ''}${n}f<sub>m</sub> = ${f} Hz`;
      labels.push(`${labelText}<br>Amp: ${amp.toFixed(3)}`);
      colors.push(n === 0 ? 'var(--purple)' : 'var(--cyan)');
    }

    const traceStems = {
      x: freqs,
      y: amps,
      type: 'bar',
      width: Math.max(0.5, fm * 0.25),
      marker: { color: colors },
      text: labels,
      hoverinfo: 'text',
    };

    const layout = baseLayout('', 'Frequency (Hz)', 'Amplitude');
    layout.xaxis.range = [fc - (numSidebands + 1) * fm, fc + (numSidebands + 1) * fm];
    layout.yaxis.rangemode = 'tozero';

    if (container.data) {
      Plotly.react(container, [traceStems], layout, plotlyConfig);
    } else {
      Plotly.newPlot(container, [traceStems], layout, plotlyConfig);
    }
  }

  // ───────── CALCULATIONS ─────────
  function updateCalculations() {
    const { msgAmp, carAmp, msgFreq, carFreq, fmDev } = state;
    const mu = msgAmp / carAmp;
    const Pc = (carAmp ** 2) / 2; // carrier power (across 1Ω)
    const Psb = (mu ** 2 * Pc) / 4; // each sideband power
    const PtotalSb = (mu ** 2 * Pc) / 2; // total sideband power
    const Pt = Pc * (1 + mu ** 2 / 2); // total power
    const amBW = 2 * msgFreq;

    const beta = fmDev / msgFreq;
    const fmBW = 2 * (fmDev + msgFreq);

    const calcData = [
      {
        label: 'AM Modulation Index (μ)',
        value: mu.toFixed(4),
        formula: `μ = Am / Ac = ${msgAmp.toFixed(1)} / ${carAmp.toFixed(1)}`,
        color: mu > 1 ? 'var(--red)' : 'var(--accent)',
      },
      {
        label: 'FM Modulation Index (β)',
        value: beta.toFixed(4),
        formula: `β = Δf / fm = ${fmDev} / ${msgFreq}`,
        color: 'var(--cyan)',
      },
      {
        label: 'Carrier Power (Pc)',
        value: Pc.toFixed(4) + ' W',
        formula: `Pc = Ac² / 2 = ${carAmp.toFixed(1)}² / 2`,
        color: 'var(--purple)',
      },
      {
        label: 'AM Total Power (Pt)',
        value: Pt.toFixed(4) + ' W',
        formula: `Pt = Pc(1 + μ²/2) = ${Pc.toFixed(3)} × (1 + ${mu.toFixed(3)}²/2)`,
        color: 'var(--green)',
      },
      {
        label: 'FM Total Power (P_fm)',
        value: Pc.toFixed(4) + ' W',
        formula: `P = Ac² / 2 = ${carAmp.toFixed(1)}² / 2 (Constant)`,
        color: 'var(--cyan)',
      },
      {
        label: 'AM Bandwidth (BW)',
        value: amBW + ' Hz',
        formula: `BW = 2fm = 2 × ${msgFreq}`,
        color: 'var(--amber)',
      },
      {
        label: 'FM Bandwidth (Carson\'s BW)',
        value: fmBW + ' Hz',
        formula: `BW = 2(Δf + fm) = 2 × (${fmDev} + ${msgFreq})`,
        color: 'var(--cyan)',
      },
    ];

    const grid = $('#calc-grid');
    grid.innerHTML = calcData
      .map(
        (c) => `
      <div class="calc-card">
        <div class="calc-card-label">${c.label}</div>
        <div class="calc-card-value" style="color:${c.color}">${c.value}</div>
        <div class="calc-card-formula">${c.formula}</div>
      </div>`
      )
      .join('');
  }

  // ───────── HEADER STATS ─────────
  function updateHeaderStats() {
    const { msgAmp, carAmp, msgFreq, carFreq, fmDev } = state;
    const mu = msgAmp / carAmp;
    const Pc = (carAmp ** 2) / 2;
    const Pt = Pc * (1 + mu ** 2 / 2);
    const amBW = 2 * msgFreq;
    
    const beta = fmDev / msgFreq;
    const fmBW = 2 * (fmDev + msgFreq);

    $('#header-mu').textContent = mu.toFixed(2);
    $('#header-power').textContent = Pt.toFixed(2) + ' W';
    $('#header-bw').textContent = amBW + ' Hz';
    
    $('#header-beta').textContent = beta.toFixed(2);
    $('#header-fmbw').textContent = fmBW + ' Hz';

    // Color coding
    const muEl = $('#header-mu');
    if (mu > 1) {
      muEl.style.color = 'var(--red)';
    } else if (Math.abs(mu - 1) < 0.01) {
      muEl.style.color = 'var(--amber)';
    } else {
      muEl.style.color = 'var(--accent)';
    }
  }

  // ───────── THEORY PANEL ─────────
  function initTheoryPanel() {
    const topics = [
      {
        icon: '📶',
        title: 'Amplitude',
        body: 'Amplitude is the peak value of a signal measured from its equilibrium (zero) position. In analog communication, it determines the strength or intensity of the signal. A larger amplitude means a stronger signal. In AM, the carrier amplitude is modulated by the message signal to encode information.',
      },
      {
        icon: '🔄',
        title: 'Frequency',
        body: 'Frequency is the number of complete cycles a signal completes per second, measured in Hertz (Hz). In communication systems, the carrier frequency is typically much higher than the message frequency. The ratio between carrier and message frequencies affects the quality and bandwidth of the modulated signal.',
      },
      {
        icon: '📐',
        title: 'Phase',
        body: 'Phase represents the angular position of a signal at a given point in time, measured in degrees or radians. It defines where in its cycle a waveform begins. Two signals of the same frequency can differ in phase — this phase difference is crucial in demodulation and interference analysis.',
      },
      {
        icon: '📡',
        title: 'Carrier Wave',
        body: 'A carrier wave is a high-frequency sinusoidal signal that acts as a vehicle to transport information (the message signal) over long distances. On its own, the carrier contains no information. Its frequency is chosen based on the communication channel and regulatory requirements. c(t) = Ac cos(2πfct + φc).',
      },
      {
        icon: '🎵',
        title: 'Message Signal',
        body: 'The message signal (or baseband signal) is the original information-bearing signal that needs to be transmitted. It can be voice, music, data, or any analog signal. In our lab, it can take the form of sine, square, or triangle waves. Its frequency is typically much lower than the carrier: m(t) = Am sin(2πfmt + φm).',
      },
      {
        icon: '🔀',
        title: 'Modulation',
        body: 'Modulation is the process of varying one or more properties of a high-frequency carrier signal (amplitude, frequency, or phase) in proportion to a message signal. In Amplitude Modulation (AM), the carrier\'s amplitude envelope follows the message signal shape. This enables efficient transmission and multiplexing of multiple signals across a shared channel.',
      },
      {
        icon: '📊',
        title: 'Modulation Index (μ)',
        body: 'The modulation index μ = Am/Ac defines the depth of modulation. When μ < 1 (under-modulation), the signal is faithfully transmitted. When μ = 1, we have 100% modulation — maximum efficiency without distortion. When μ > 1 (over-modulation), the envelope crosses zero and causes distortion, making faithful demodulation impossible with simple envelope detectors.',
      },
      {
        icon: '📈',
        title: 'Sidebands',
        body: 'When a carrier is amplitude-modulated by a message signal, two new frequency components appear in the spectrum: the Upper Sideband (USB) at fc + fm and the Lower Sideband (LSB) at fc − fm. These sidebands carry the actual information. The carrier itself carries no information but consumes two-thirds of the total power. This insight leads to advanced techniques like SSB (Single Sideband) modulation.',
      },
      {
        icon: '🔋',
        title: 'Bandwidth',
        body: 'Bandwidth is the range of frequencies occupied by the modulated signal. For standard AM (DSB-FC), the bandwidth is BW = 2fm, where fm is the highest frequency component of the message signal. Efficient use of bandwidth is critical in communication system design, as radio spectrum is a finite and valuable resource.',
      },
    ];

    const grid = $('#theory-grid');
    grid.innerHTML = topics
      .map(
        (t) => `
      <div class="theory-card">
        <div class="theory-card-header" onclick="this.parentElement.classList.toggle('open')">
          <h3>${t.icon} ${t.title}</h3>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="theory-card-body"><p>${t.body}</p></div>
      </div>`
      )
      .join('');
  }

  // ───────── PRESETS ─────────
  function initPresets() {
    const presets = [
      {
        name: 'Low Modulation',
        desc: 'μ = 0.3 — Carrier envelope shows gentle variation. Signal is under-modulated.',
        tag: 'μ < 1',
        tagColor: 'var(--green)',
        tagBg: 'var(--green-glow)',
        params: { msgAmp: 0.9, msgFreq: 5, msgPhase: 0, carAmp: 3, carFreq: 100, carPhase: 0, waveType: 'sine', fmDev: 15 },
      },
      {
        name: '100% Modulation',
        desc: 'μ = 1.0 — Maximum modulation without distortion. Envelope just touches zero.',
        tag: 'μ = 1',
        tagColor: 'var(--amber)',
        tagBg: 'var(--amber-glow)',
        params: { msgAmp: 3, msgFreq: 5, msgPhase: 0, carAmp: 3, carFreq: 100, carPhase: 0, waveType: 'sine', fmDev: 30 },
      },
      {
        name: 'Over Modulation',
        desc: 'μ = 1.5 — Distortion occurs. Envelope inverts, causing phase reversals.',
        tag: 'μ > 1',
        tagColor: 'var(--red)',
        tagBg: 'var(--red-glow)',
        params: { msgAmp: 4.5, msgFreq: 5, msgPhase: 0, carAmp: 3, carFreq: 100, carPhase: 0, waveType: 'sine', fmDev: 45 },
      },
      {
        name: 'High Frequency Carrier',
        desc: 'fc = 400 Hz — Dense carrier oscillation inside the modulation envelope.',
        tag: 'HIGH fc',
        tagColor: 'var(--purple)',
        tagBg: 'var(--purple-glow)',
        params: { msgAmp: 1.5, msgFreq: 5, msgPhase: 0, carAmp: 3, carFreq: 400, carPhase: 0, waveType: 'sine', fmDev: 100 },
      },
      {
        name: 'Low Frequency Carrier',
        desc: 'fc = 25 Hz — Few carrier cycles per message period; poor AM fidelity.',
        tag: 'LOW fc',
        tagColor: 'var(--accent)',
        tagBg: 'var(--accent-glow)',
        params: { msgAmp: 1, msgFreq: 3, msgPhase: 0, carAmp: 3, carFreq: 25, carPhase: 0, waveType: 'sine', fmDev: 10 },
      },
      {
        name: 'Wideband FM (WBFM)',
        desc: 'β = 10.0 — Large frequency deviation. Many significant Bessel sidebands are visible.',
        tag: 'WBFM (β=10)',
        tagColor: 'var(--cyan)',
        tagBg: 'var(--cyan-glow)',
        params: { msgAmp: 1.5, msgFreq: 5, msgPhase: 0, carAmp: 3, carFreq: 100, carPhase: 0, waveType: 'sine', fmDev: 50 },
      },
      {
        name: 'Narrowband FM (NBFM)',
        desc: 'β = 0.5 — Small frequency deviation. Spectrum is very narrow, resembling AM.',
        tag: 'NBFM (β<1)',
        tagColor: 'var(--cyan)',
        tagBg: 'var(--cyan-glow)',
        params: { msgAmp: 1.5, msgFreq: 10, msgPhase: 0, carAmp: 3, carFreq: 100, carPhase: 0, waveType: 'sine', fmDev: 5 },
      },
    ];

    const grid = $('#presets-grid');
    grid.innerHTML = presets
      .map(
        (p, i) => `
      <div class="preset-card" data-preset="${i}" id="preset-${i}">
        <h4>${p.name}</h4>
        <p>${p.desc}</p>
        <span class="preset-tag" style="background:${p.tagBg}; color:${p.tagColor}">${p.tag}</span>
      </div>`
      )
      .join('');

    // Click handlers
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.preset-card');
      if (!card) return;
      const idx = parseInt(card.dataset.preset, 10);
      applyPreset(presets[idx].params);
    });
  }

  function applyPreset(params) {
    // Update state
    Object.assign(state, params);

    // Update sliders
    msgAmpSlider.value = params.msgAmp;
    msgFreqSlider.value = params.msgFreq;
    msgPhaseSlider.value = params.msgPhase;
    carAmpSlider.value = params.carAmp;
    carFreqSlider.value = params.carFreq;
    carPhaseSlider.value = params.carPhase;
    if (params.fmDev !== undefined) {
      fmDevSlider.value = params.fmDev;
    }

    // Update display values
    $('#msg-amp-val').textContent = params.msgAmp.toFixed(1);
    $('#msg-freq-val').textContent = params.msgFreq;
    $('#msg-phase-val').textContent = params.msgPhase;
    $('#car-amp-val').textContent = params.carAmp.toFixed(1);
    $('#car-freq-val').textContent = params.carFreq;
    $('#car-phase-val').textContent = params.carPhase;
    if (params.fmDev !== undefined) {
      $('#fm-dev-val').textContent = params.fmDev;
    }

    // Update wave type buttons
    if (params.waveType) {
      state.waveType = params.waveType;
      waveBtns.forEach((b) => {
        b.classList.toggle('active', b.dataset.wave === params.waveType);
      });
    }

    // Refresh slider fills
    const slidersToFill = [msgAmpSlider, msgFreqSlider, msgPhaseSlider, carAmpSlider, carFreqSlider, carPhaseSlider];
    if (params.fmDev !== undefined) {
      slidersToFill.push(fmDevSlider);
    }
    slidersToFill.forEach(updateSliderFill);

    onParamChange();
  }

  // ───────── VIRTUAL LAB ─────────
  function updateLabGraph() {
    const { labMu, labBeta, labFm, labFc } = state;
    const Ac = 3;
    const duration = 4 / labFm;
    const sr = Math.max(5000, labFc * 40);
    const t = timeArray(duration, sr);
    const tArr = Array.from(t);

    const yAm = tArr.map((ti) => {
      const m = Math.sin(2 * Math.PI * labFm * ti);
      const c = Ac * Math.cos(2 * Math.PI * labFc * ti);
      return (1 + labMu * m) * c;
    });

    const yFm = tArr.map((ti) => {
      return Ac * Math.cos(2 * Math.PI * labFc * ti + labBeta * Math.sin(2 * Math.PI * labFm * ti));
    });

    plotMiniGraph('lab-am-graph', tArr, yAm, 'var(--green)');
    plotMiniGraph('lab-fm-graph', tArr, yFm, 'var(--cyan)');
  }

  function plotMiniGraph(containerId, x, y, color) {
    const container = $(`#${containerId}`);
    if (!container) return;

    const trace = {
      x,
      y,
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 1.5 },
      hoverinfo: 'x+y',
    };

    const layout = {
      paper_bgcolor: plotlyBg,
      plot_bgcolor: plotlyBg,
      margin: { l: 40, r: 10, t: 8, b: 30 },
      xaxis: {
        gridcolor,
        zerolinecolor: 'rgba(255,255,255,0.1)',
        tickfont: { ...axisFont, size: 10 },
        title: { text: 'Time (s)', font: { ...axisFont, size: 10 } },
      },
      yaxis: {
        gridcolor,
        zerolinecolor: 'rgba(255,255,255,0.1)',
        tickfont: { ...axisFont, size: 10 },
      },
      showlegend: false,
    };

    if (container.data) {
      Plotly.react(container, [trace], layout, { responsive: true, displayModeBar: false });
    } else {
      Plotly.newPlot(container, [trace], layout, { responsive: true, displayModeBar: false });
    }
  }

  function updateObservations() {
    const { labMu, labBeta, labFm, labFc } = state;
    const observations = [];

    // AM Modulation Index observations
    if (labMu < 0.3) {
      observations.push(
        `The AM modulation index is very low (μ = ${labMu.toFixed(2)}). The carrier envelope barely changes — most of the signal power is wasted on the carrier component.`
      );
    } else if (labMu < 1) {
      observations.push(
        `With μ = ${labMu.toFixed(2)}, the AM envelope clearly follows the message shape. This is proper under-modulation — ideal for envelope detection and demodulation.`
      );
    } else if (Math.abs(labMu - 1) < 0.02) {
      observations.push(
        'At μ ≈ 1 (100% modulation), the envelope just touches zero. This represents maximum modulation depth without distortion. Power efficiency of the sidebands is maximized at 33.3%.'
      );
    } else {
      observations.push(
        `Over-modulation detected! μ = ${labMu.toFixed(2)} > 1. The envelope crosses zero and inverts, causing phase reversals. A standard diode envelope detector will produce heavily distorted output.`
      );
    }

    // FM Modulation Index observations
    if (labBeta < 1) {
      observations.push(
        `The FM modulation index is low (β = ${labBeta.toFixed(1)} < 1), representing Narrowband FM (NBFM). The spectrum is narrow and contains only the carrier and the first pair of sidebands, similar to AM.`
      );
    } else if (labBeta < 5) {
      observations.push(
        `With β = ${labBeta.toFixed(1)}, the signal is in the transitional or Moderate Wideband FM range. Several sidebands carry significant power, improving noise immunity compared to NBFM.`
      );
    } else {
      observations.push(
        `With β = ${labBeta.toFixed(1)} ≥ 5, we have Wideband FM (WBFM). The signal contains many sideband components. WBFM offers excellent noise suppression (FM improvement threshold) at the expense of a wider bandwidth.`
      );
    }

    // Frequency ratio observations
    const ratio = labFc / labFm;
    if (ratio < 5) {
      observations.push(
        `Warning: The carrier-to-message frequency ratio is only ${ratio.toFixed(1)}:1. For proper modulation and envelope tracing, f_c should be at least 10× f_m. Few carrier cycles fit within each message period, leading to poor signal quality.`
      );
    } else if (ratio > 50) {
      observations.push(
        `Excellent frequency ratio of ${ratio.toFixed(0)}:1. Many carrier cycles fit within each message period, producing clean AM envelopes and highly detailed FM frequency swings.`
      );
    } else {
      observations.push(
        `The carrier-to-message frequency ratio is ${ratio.toFixed(1)}:1. This is a standard ECE laboratory ratio providing a clear visualization of both message cycles and individual carrier cycles.`
      );
    }

    // AM Bandwidth vs FM Bandwidth
    const amBW = 2 * labFm;
    const fmBW = 2 * (labBeta * labFm + labFm); // Carson's rule: 2(Δf + fm) where Δf = β * fm
    observations.push(
      `Bandwidth comparison: AM BW = 2f_m = ${amBW} Hz. Carson's FM BW = 2(β + 1)f_m = ${fmBW.toFixed(0)} Hz. FM occupies ${(fmBW / amBW).toFixed(1)}× more spectrum than AM for these settings.`
    );

    // Power comparison
    const amEta = (labMu ** 2 / (2 + labMu ** 2)) * 100;
    observations.push(
      `AM Power Efficiency: η = ${amEta.toFixed(1)}%. FM transmitter power remains constant at P_total = A_c²/2 = 4.5 W regardless of modulation index, as the amplitude is constant and information is stored in frequency.`
    );

    // Render
    const list = $('#observations-list');
    list.innerHTML = observations.map((o) => `<li>${o}</li>`).join('');
  }

  // ───────── GRAPH ACTIONS ─────────
  function initGraphActions() {
    const clearBtn = $('#btn-clear-graphs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        ['plot-message', 'plot-carrier', 'plot-am', 'plot-am-spectrum', 'plot-fm', 'plot-fm-spectrum', 'lab-am-graph', 'lab-fm-graph'].forEach((id) => {
          const el = $(`#${id}`);
          if (el) Plotly.purge(el);
        });
      });
    }

    const downloadBtn = $('#btn-download-graphs');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        ['plot-message', 'plot-carrier', 'plot-am', 'plot-am-spectrum', 'plot-fm', 'plot-fm-spectrum'].forEach((id) => {
          const el = $(`#${id}`);
          if (el && el.data) {
            Plotly.downloadImage(el, {
              format: 'jpeg',
              filename: `modulation_lab_${id}`,
              height: 600,
              width: 1000,
              scale: 2,
            });
          }
        });
      });
    }
  }

  // ───────── INIT ─────────
  function init() {
    initNavigation();
    initWavePicker();
    initSliders();
    initTheoryPanel();
    initPresets();
    initGraphActions();

    // Initial render
    onParamChange();
  }

  // Wait for Plotly to load, then init
  if (typeof Plotly !== 'undefined') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
