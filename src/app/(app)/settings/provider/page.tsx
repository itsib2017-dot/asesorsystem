import { getProviderConfigAction } from "./actions";
import ProviderSettingsForm from "./_components/provider-settings-form";

export const metadata = {
  title: "Provider Settings — AsesorKompetensi",
};

export default async function ProviderSettingsPage() {
  const config = await getProviderConfigAction();
  return <ProviderSettingsForm initialConfig={config} />;
}
