import { FormRouteScreen } from "../components/FormRouteScreen";
import { useDemoState } from "../components/DemoState";

export default function StartRoute() {
  const { newFormKey } = useDemoState();

  return <FormRouteScreen formKey={`new-${newFormKey}`} title="Start New" />;
}
