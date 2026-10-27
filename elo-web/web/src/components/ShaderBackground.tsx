import { useEffect, useRef } from 'react';
import frag from '@/shaders/silk.frag?raw';

const VERT = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;
const COLORS = [0.008, 0.004, 0.039, 0.016, 0.02, 0.18, 0.239, 0.173, 0.553, 0.569, 0.42, 0.749];

/** Fondo "Silk": canvas WebGL1 a pantalla completa, detrás del contenido. */
export default function ShaderBackground({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { canvas.style.background = 'linear-gradient(135deg,#02010A,#04052E 40%,#3D2C8D)'; return; }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('[shader]', gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error('[shader]', gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);

    // Triángulo que cubre toda la pantalla
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const colors = new Float32Array(24); colors.set(COLORS);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uColors = U('u_colors'), uScene = U('u_scene'), uShape = U('u_shape'), uSurface = U('u_surface');
    const uFinish = U('u_finish'), uTransform = U('u_transform'), uSpace = U('u_space'), uCursor = U('u_cursor');
    gl.uniform3fv(uColors, colors);
    gl.uniform4f(uShape, 1.26, 0.28, 0.5, 0.0);
    gl.uniform4f(uSurface, 2.4, 1.11, 0.0, 1.0);
    gl.uniform4f(uFinish, 0.0, 0.0, 0.0, 0.05);
    gl.uniform4f(uTransform, 1581.0, 0.0, 0.0, 0.0);
    gl.uniform4f(uSpace, 0.0, 0.0, 0.0, 0.0);
    gl.uniform4f(uCursor, 0.0, 2.0, 0.65, 0.46); // cursor apagado (presence = 0)

    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0, elapsed = 0, last = performance.now();
    const frame = (now: number) => {
      elapsed += (now - last) / 1000; last = now;
      gl.uniform4f(uScene, w, h, elapsed * 0.76, 4.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none fixed inset-0 z-0 h-full w-full ${className}`} />;
}
