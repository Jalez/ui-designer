const SVG_NS = "http://www.w3.org/2000/svg";

export const SNAP_DURATION_MS = 3500;
export const TOTAL_EFFECT_MS = 7500;
export const EXIT_LAYER_REMOVE_DELAY_MS = TOTAL_EFFECT_MS + 500;
export const EXIT_BUFFER_AFTER_SNAP_MS = TOTAL_EFFECT_MS - SNAP_DURATION_MS + 500;
export const SNAP_MAX_DISPLACEMENT_SCALE = 18;
export const SNAP_MIN_PARTICLES = 150;
export const SNAP_MAX_PARTICLES = 300;
export const SNAP_MIN_PETALS = 35;
export const SNAP_MAX_PETALS = 70;
export const SNAP_MIN_DUST = 200;
export const SNAP_MAX_DUST = 400;

type SnapParticle = {
  node: SVGCircleElement;
  startX: number;
  startY: number;
  seed: number;
  windStrength: number;
  riseSpeed: number;
  wobbleAmp: number;
  wobbleFreq: number;
  radius: number;
  delay: number;
};

type SnapPetal = {
  node: SVGEllipseElement;
  startX: number;
  startY: number;
  seed: number;
  windStrength: number;
  riseSpeed: number;
  wobbleAmp: number;
  wobbleFreq: number;
  radiusX: number;
  radiusY: number;
  spinSpeed: number;
  spinPhase: number;
  delay: number;
};

type SnapDust = {
  node: SVGCircleElement;
  startX: number;
  startY: number;
  seed: number;
  windStrength: number;
  riseSpeed: number;
  radius: number;
  delay: number;
};

function createSvgElement<T extends SVGElement>(tag: string): T {
  return document.createElementNS(SVG_NS, tag) as T;
}

export function createSnapDissolveFilter(defs: SVGDefsElement): {
  filterId: string;
  displacementNode: SVGFEDisplacementMapElement;
  stepFuncNode: SVGFEFuncAElement;
} {
  const filterId = `word-cloud-dissolve-${Math.random().toString(36).slice(2)}`;
  const filter = createSvgElement<SVGFilterElement>("filter");
  filter.setAttribute("id", filterId);
  filter.setAttribute("x", "-30%");
  filter.setAttribute("y", "-30%");
  filter.setAttribute("width", "160%");
  filter.setAttribute("height", "160%");
  defs.appendChild(filter);

  const turbulence = createSvgElement<SVGFETurbulenceElement>("feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", "0.022 0.028");
  turbulence.setAttribute("numOctaves", "2");
  turbulence.setAttribute("seed", String(Math.floor(Math.random() * 10000)));
  turbulence.setAttribute("result", "noise");
  filter.appendChild(turbulence);

  const remapTransfer = createSvgElement<SVGFEComponentTransferElement>("feComponentTransfer");
  remapTransfer.setAttribute("in", "noise");
  remapTransfer.setAttribute("result", "remapped");
  filter.appendChild(remapTransfer);

  const remapFunc = createSvgElement<SVGFEFuncRElement>("feFuncR");
  remapFunc.setAttribute("type", "linear");
  remapFunc.setAttribute("slope", String(1 / (0.8 - 0.2)));
  remapFunc.setAttribute("intercept", String(-0.2 * (1 / (0.8 - 0.2))));
  remapTransfer.appendChild(remapFunc);

  const alphaMatrix = createSvgElement<SVGFEColorMatrixElement>("feColorMatrix");
  alphaMatrix.setAttribute("type", "matrix");
  alphaMatrix.setAttribute("in", "remapped");
  alphaMatrix.setAttribute("values", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0");
  alphaMatrix.setAttribute("result", "noiseAlpha");
  filter.appendChild(alphaMatrix);

  const dissolveStep = createSvgElement<SVGFEComponentTransferElement>("feComponentTransfer");
  dissolveStep.setAttribute("in", "noiseAlpha");
  dissolveStep.setAttribute("result", "mask");
  filter.appendChild(dissolveStep);

  const stepFuncNode = createSvgElement<SVGFEFuncAElement>("feFuncA");
  stepFuncNode.setAttribute("type", "linear");
  stepFuncNode.setAttribute("slope", "200");
  stepFuncNode.setAttribute("intercept", "0");
  dissolveStep.appendChild(stepFuncNode);

  const composite = createSvgElement<SVGFECompositeElement>("feComposite");
  composite.setAttribute("operator", "in");
  composite.setAttribute("in", "SourceGraphic");
  composite.setAttribute("in2", "mask");
  composite.setAttribute("result", "dissolved");
  filter.appendChild(composite);

  const displacementNode = createSvgElement<SVGFEDisplacementMapElement>("feDisplacementMap");
  displacementNode.setAttribute("in", "dissolved");
  displacementNode.setAttribute("in2", "noise");
  displacementNode.setAttribute("scale", "0");
  displacementNode.setAttribute("xChannelSelector", "R");
  displacementNode.setAttribute("yChannelSelector", "G");
  filter.appendChild(displacementNode);

  return {
    filterId,
    displacementNode,
    stepFuncNode,
  };
}

export function startSvgTextSnapEffect(options: {
  svg: SVGSVGElement;
  dissolveTarget: SVGGElement;
  displacementNode: SVGFEDisplacementMapElement | null;
  stepFuncNode: SVGFEFuncAElement | null;
  particleColor: string;
  isDarkMode?: boolean;
  removeTarget?: SVGElement;
}): () => void {
  const {
    svg,
    dissolveTarget,
    displacementNode,
    stepFuncNode,
    particleColor,
    isDarkMode = false,
    removeTarget = svg,
  } = options;

  let animationFrameId: number | null = null;
  const timeoutIds: number[] = [];
  let cancelled = false;

  const stop = () => {
    cancelled = true;
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };

  if (!displacementNode || !stepFuncNode) {
    const timeoutId = window.setTimeout(() => {
      if (removeTarget.isConnected) {
        removeTarget.remove();
      }
    }, EXIT_LAYER_REMOVE_DELAY_MS);
    timeoutIds.push(timeoutId);
    return stop;
  }

  stepFuncNode.setAttribute("intercept", "0");
  displacementNode.setAttribute("scale", "0");

  const heroTextNode = dissolveTarget.querySelector("text");
  const particleLayer = createSvgElement<SVGGElement>("g");
  particleLayer.setAttribute("class", "word-cloud-snap-particles");
  particleLayer.setAttribute("transform", dissolveTarget.getAttribute("transform") || "");
  svg.appendChild(particleLayer);

  const particles: SnapParticle[] = [];
  const petals: SnapPetal[] = [];
  const dust: SnapDust[] = [];

  if (heroTextNode) {
    const bbox = heroTextNode.getBBox();
    const area = bbox.width * bbox.height;
    const particleCount = Math.max(
      SNAP_MIN_PARTICLES,
      Math.min(SNAP_MAX_PARTICLES, Math.floor(area / 1000)),
    );
    const petalCount = Math.max(
      SNAP_MIN_PETALS,
      Math.min(SNAP_MAX_PETALS, Math.floor(particleCount * 0.25)),
    );
    const dustCount = Math.max(
      SNAP_MIN_DUST,
      Math.min(SNAP_MAX_DUST, Math.floor(area / 600)),
    );
    const petalColors = ["#f2f2f2", "#e8c4c8", "#bb6b70", "#d4948a", "#c9a0a0"];

    for (let i = 0; i < dustCount; i += 1) {
      const node = createSvgElement<SVGCircleElement>("circle");
      const startX = bbox.x + Math.random() * bbox.width;
      const startY = bbox.y + Math.random() * bbox.height;
      node.setAttribute("cx", String(startX));
      node.setAttribute("cy", String(startY));
      node.setAttribute("r", "0");
      node.setAttribute("fill", particleColor);
      node.style.opacity = "0";
      particleLayer.appendChild(node);
      dust.push({
        node,
        startX,
        startY,
        seed: Math.random() * Math.PI * 2,
        windStrength: 20 + Math.random() * 60,
        riseSpeed: 15 + Math.random() * 45,
        radius: 0.3 + Math.random() * 0.7,
        delay: Math.random() * 0.6,
      });
    }

    for (let i = 0; i < particleCount; i += 1) {
      const node = createSvgElement<SVGCircleElement>("circle");
      const startX = bbox.x + Math.random() * bbox.width;
      const startY = bbox.y + Math.random() * bbox.height;
      node.setAttribute("cx", String(startX));
      node.setAttribute("cy", String(startY));
      node.setAttribute("r", "0");
      node.setAttribute("fill", particleColor);
      node.style.opacity = "0";
      particleLayer.appendChild(node);
      particles.push({
        node,
        startX,
        startY,
        seed: Math.random() * Math.PI * 2,
        windStrength: 40 + Math.random() * 120,
        riseSpeed: 20 + Math.random() * 80,
        wobbleAmp: 8 + Math.random() * 24,
        wobbleFreq: 2 + Math.random() * 4,
        radius: 0.6 + Math.random() * 2,
        delay: Math.random() * 0.45,
      });
    }

    for (let i = 0; i < petalCount; i += 1) {
      const node = createSvgElement<SVGEllipseElement>("ellipse");
      const startX = bbox.x + Math.random() * bbox.width;
      const startY = bbox.y + Math.random() * bbox.height;
      node.setAttribute("cx", String(startX));
      node.setAttribute("cy", String(startY));
      node.setAttribute("rx", "0");
      node.setAttribute("ry", "0");
      node.setAttribute("fill", petalColors[i % petalColors.length]);
      node.style.opacity = "0";
      node.style.mixBlendMode = isDarkMode ? "screen" : "multiply";
      particleLayer.appendChild(node);
      petals.push({
        node,
        startX,
        startY,
        seed: Math.random() * Math.PI * 2,
        windStrength: 50 + Math.random() * 160,
        riseSpeed: 30 + Math.random() * 100,
        wobbleAmp: 12 + Math.random() * 30,
        wobbleFreq: 1.5 + Math.random() * 3,
        radiusX: 1.4 + Math.random() * 3,
        radiusY: 0.6 + Math.random() * 1.8,
        spinSpeed: 120 + Math.random() * 300,
        spinPhase: Math.random() * 360,
        delay: Math.random() * 0.35,
      });
    }
  }

  const startTime = performance.now();
  const DUST_LIFE = 4;
  const PARTICLE_LIFE = 4;
  const PETAL_LIFE = 6;
  const snapDurationSec = SNAP_DURATION_MS / 1000;

  const animate = (currentTime: number) => {
    if (cancelled) {
      return;
    }

    const elapsed = currentTime - startTime;
    const dissolveProgress = Math.min(1, elapsed / SNAP_DURATION_MS);
    const totalProgress = elapsed / TOTAL_EFFECT_MS;

    if (dissolveProgress < 1) {
      const dissolveOvershoot = dissolveProgress * 1.15;
      stepFuncNode.setAttribute("intercept", (-dissolveOvershoot * 200).toFixed(2));
      displacementNode.setAttribute("scale", String(dissolveProgress * SNAP_MAX_DISPLACEMENT_SCALE));
    }

    dust.forEach((entry) => {
      const birthSec = entry.delay * snapDurationSec;
      const age = elapsed / 1000 - birthSec;
      if (age <= 0) return;
      const lp = Math.min(1, age / DUST_LIFE);
      const x = entry.startX + entry.windStrength * age;
      const y = entry.startY - entry.riseSpeed * age;
      const scaleIn = Math.min(1, lp / 0.03);
      const fadeOut = lp > 0.8 ? 1 - (lp - 0.8) / 0.2 : 1;
      entry.node.setAttribute("cx", String(x));
      entry.node.setAttribute("cy", String(y));
      entry.node.setAttribute("r", String(entry.radius * scaleIn));
      entry.node.style.opacity = String(Math.max(0, fadeOut * 0.6));
    });

    particles.forEach((entry) => {
      const birthSec = entry.delay * snapDurationSec;
      const age = elapsed / 1000 - birthSec;
      if (age <= 0) return;
      const lp = Math.min(1, age / PARTICLE_LIFE);
      const wind = entry.windStrength * age;
      const rise = entry.riseSpeed * age;
      const wobbleX = entry.wobbleAmp * Math.sin(age * entry.wobbleFreq + entry.seed);
      const wobbleY = entry.wobbleAmp * 0.7 * Math.cos(age * entry.wobbleFreq * 1.3 + entry.seed + 1.7);
      const life = 1 - lp;
      const scaleIn = Math.min(1, lp / 0.03);
      const fadeOut = lp > 0.8 ? 1 - (lp - 0.8) / 0.2 : 1;
      entry.node.setAttribute("cx", String(entry.startX + wind + wobbleX));
      entry.node.setAttribute("cy", String(entry.startY - rise + wobbleY));
      entry.node.setAttribute("r", String(entry.radius * scaleIn * (0.4 + 0.6 * life)));
      entry.node.style.opacity = String(Math.max(0, Math.pow(fadeOut, 1.3)));
    });

    petals.forEach((entry) => {
      const birthSec = entry.delay * snapDurationSec;
      const age = elapsed / 1000 - birthSec;
      if (age <= 0) return;
      const lp = Math.min(1, age / PETAL_LIFE);
      const wind = entry.windStrength * age;
      const rise = entry.riseSpeed * age;
      const wobbleX = entry.wobbleAmp * Math.sin(age * entry.wobbleFreq + entry.seed);
      const wobbleY = entry.wobbleAmp * 0.6 * Math.cos(age * entry.wobbleFreq * 1.1 + entry.seed + 2.1);
      const life = 1 - lp;
      const scaleIn = Math.min(1, lp / 0.04);
      const rx = entry.radiusX * scaleIn * (0.5 + 0.5 * life);
      const ry = entry.radiusY * scaleIn * (0.4 + 0.6 * life);
      const breathe = Math.sin(age * 3.5 + entry.seed) * 0.3;
      const x = entry.startX + wind + wobbleX;
      const y = entry.startY - rise + wobbleY;
      const fadeOut = lp > 0.8 ? 1 - (lp - 0.8) / 0.2 : 1;
      entry.node.setAttribute("cx", String(x));
      entry.node.setAttribute("cy", String(y));
      entry.node.setAttribute("rx", String(Math.max(0, rx * (1 + breathe))));
      entry.node.setAttribute("ry", String(Math.max(0, ry * (1 - breathe * 0.5))));
      entry.node.setAttribute("transform", `rotate(${(entry.spinPhase + entry.spinSpeed * lp).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`);
      entry.node.style.opacity = String(Math.max(0, Math.pow(fadeOut, 1.1)));
    });

    if (totalProgress < 1) {
      animationFrameId = window.requestAnimationFrame(animate);
      return;
    }

    displacementNode.setAttribute("scale", "0");
    const timeoutId = window.setTimeout(() => {
      if (removeTarget.isConnected) {
        removeTarget.remove();
      }
    }, EXIT_BUFFER_AFTER_SNAP_MS);
    timeoutIds.push(timeoutId);
  };

  animationFrameId = window.requestAnimationFrame(animate);
  return stop;
}
