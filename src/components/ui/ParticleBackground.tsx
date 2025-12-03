import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  type: "dot" | "line" | "data";
  data?: string;
}

export const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    const dataStrings = ["0x1F4A", "NODE", "SYNC", "DATA", "0xFF", "INIT", "LOAD", "EXEC"];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000);

      for (let i = 0; i < particleCount; i++) {
        const type = Math.random() > 0.85 ? "data" : Math.random() > 0.5 ? "dot" : "line";
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.3 + 0.2,
          size: type === "data" ? 10 : Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.1,
          type,
          data: type === "data" ? dataStrings[Math.floor(Math.random() * dataStrings.length)] : undefined,
        });
      }
    };

    const drawConnections = () => {
      const connectionDistance = 150;
      ctx.strokeStyle = "hsla(185, 80%, 45%, 0.1)";
      ctx.lineWidth = 0.5;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.15;
            ctx.strokeStyle = `hsla(185, 80%, 45%, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections first
      drawConnections();

      // Draw and update particles
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        if (particle.type === "dot") {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(185, 80%, 45%, ${particle.opacity})`;
          ctx.fill();
        } else if (particle.type === "line") {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x + particle.size * 4, particle.y);
          ctx.strokeStyle = `hsla(349, 85%, 50%, ${particle.opacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (particle.type === "data" && particle.data) {
          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = `hsla(185, 80%, 45%, ${particle.opacity * 0.6})`;
          ctx.fillText(particle.data, particle.x, particle.y);
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    resize();
    createParticles();
    animate();

    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
};
