// Espejo en TypeScript de `ServerSendData` (src-tauri/src/commands/servers.rs).
//
// F10.0f: los canales de servidor (`REMOTE`, `STAGE`, `CONTROLLER`,
// `OUTPUT_STREAM`) viajan por el comando `SERVER_SEND`, que difunde `message`
// (JSON tal cual como en el socket.io de Electron: `{ id?, channel, data }`)
// a la sala indicada por `channel` ("remote" | "stage" | "controller" |
// "output_stream").
export interface ServerSendData {
    channel: string
    // serde_json::Value en Rust: el mensaje se difunde sin interpretar.
    message: any
}
