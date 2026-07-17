import { WhoVaForm } from "@who-va/instrument/web";

export default function App() {
  return <WhoVaForm onComplete={(result) => console.log(result)} />;
}
