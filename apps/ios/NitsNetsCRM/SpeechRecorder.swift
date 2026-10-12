import Foundation
import Speech
import AVFoundation

@MainActor final class SpeechRecorder: ObservableObject {
    @Published var transcript = ""
    @Published var recording = false
    @Published var preparing = false
    @Published var error: String?
    private var engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var tapInstalled = false
    private var recordingId = UUID()
    func start() async {
        guard !preparing, !recording else { return }
        preparing = true; defer { preparing = false }
        let speech = await withCheckedContinuation { continuation in SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) } }
        guard speech == .authorized else { error = "Autoriza el reconocimiento de voz en Ajustes para dictar. Puedes escribir la nota igualmente."; return }
        let microphone = await AVAudioApplication.requestRecordPermission()
        guard microphone else { error = "Autoriza el micrófono en Ajustes para dictar. Puedes escribir la nota igualmente."; return }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "es-ES")), recognizer.isAvailable else { error = "El dictado no está disponible en este dispositivo."; return }
        // Never send a user's private CRM dictation to Apple's servers silently.
        guard recognizer.supportsOnDeviceRecognition else { error = "Este dispositivo no permite dictado local en español. Escribe la nota; no se enviará el audio a un servicio externo."; return }
        do {
            stop(); error = nil; transcript = ""
            let recordingId = UUID(); self.recordingId = recordingId
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement, options: .duckOthers); try audio.setActive(true)
            let request = SFSpeechAudioBufferRecognitionRequest(); request.shouldReportPartialResults = true; request.requiresOnDeviceRecognition = true; self.request = request
            let input = engine.inputNode; let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw APIError(message: "No se ha encontrado un micrófono disponible.") }
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }; tapInstalled = true
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                Task { @MainActor in
                    guard self?.recordingId == recordingId else { return }
                    if let result { self?.transcript = result.bestTranscription.formattedString }
                    if result?.isFinal == true || error != nil { self?.stop() }
                    if let error, self?.transcript.isEmpty == true { self?.error = error.localizedDescription }
                }
            }
            engine.prepare(); try engine.start(); recording = true
        } catch { stop(); self.error = error.localizedDescription }
    }
    func stop() {
        recordingId = UUID()
        engine.stop(); if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        request?.endAudio(); task?.cancel(); task = nil; request = nil; recording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
