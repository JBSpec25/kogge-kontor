import UIKit
import Capacitor
import StoreKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = KKViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// MARK: - Kogge & Kontor

/// Hauptansicht: Capacitor-WebView mit dem Spiel, dazu das Kauf-Plugin der App.
class KKViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(KKStorePlugin())
    }
}

/// Kauf der Vollversion über StoreKit 2 (einmaliger Kauf, nicht verbrauchbar).
/// JavaScript: products({ids}), owned({id}), purchase({id}), restore({id})
@objc(KKStorePlugin)
public class KKStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KKStorePlugin"
    public let jsName = "KKStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "owned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]
    private var updates: Task<Void, Never>?

    override public func load() {
        // Käufe, die außerhalb der App abgeschlossen werden (z. B. nach Bestätigung durch die Eltern)
        updates = Task.detached {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                }
            }
        }
    }

    deinit { updates?.cancel() }

    private static func isOwned(_ id: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == id,
               transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }

    @objc func products(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let list = try await Product.products(for: ids)
                let out: [[String: Any]] = list.map { ["id": $0.id, "displayPrice": $0.displayPrice, "title": $0.displayName] }
                call.resolve(["products": out])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func owned(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("id fehlt"); return }
        Task {
            let owned = await KKStorePlugin.isOwned(id)
            call.resolve(["owned": owned])
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("id fehlt"); return }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("Produkt nicht gefunden")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(["state": "purchased"])
                    case .unverified:
                        call.reject("Kauf konnte nicht bestätigt werden")
                    }
                case .pending:
                    call.resolve(["state": "pending"])
                case .userCancelled:
                    call.resolve(["state": "cancelled"])
                @unknown default:
                    call.resolve(["state": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("id fehlt"); return }
        Task {
            try? await AppStore.sync()
            let owned = await KKStorePlugin.isOwned(id)
            call.resolve(["owned": owned])
        }
    }
}
