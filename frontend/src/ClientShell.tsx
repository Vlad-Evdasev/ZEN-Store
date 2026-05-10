import App from "./App";

// Customer-shell: только App. Раньше тут был TonConnectUIProvider —
// убрали после перехода на bot-flow оплаты (ton:// инвойс приходит
// в Telegram-бот, кошелёк юзер открывает оттуда). @tonconnect/ui-react
// и @ton/core больше не входят в bundle вообще.
export default function ClientShell() {
  return <App />;
}
