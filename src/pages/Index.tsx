import NeuralCore from "@/components/NeuralCore";

const Index = () => {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <h1 className="sr-only">Neural Energy Core – Three.js WebGL Visualization</h1>
      <NeuralCore />
      <div className="pointer-events-none absolute bottom-6 left-6 select-none font-mono text-xs uppercase tracking-[0.3em] text-foreground/60">
        Neural Core · WebGL · GLSL
      </div>
    </main>
  );
};

export default Index;
