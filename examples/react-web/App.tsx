import { WhoVaForm } from "@drguptavivek/who-2022-va/web";

export default function App() {
  return <WhoVaForm onComplete={(result) => console.log(result)} />;
}
