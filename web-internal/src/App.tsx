import { Toaster } from "@/components/ui/sonner";
import { AppRouter } from "@/core/router/AppRouter";

function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  );
}

export default App;
