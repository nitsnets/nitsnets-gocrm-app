import SwiftUI

// Neutral hierarchy adapted from GTT GADD UX; native materials and system type
// follow Apple's iOS 26 design. See docs/design-ios-liquid-glass.md.
extension View {
    func crmScreen() -> some View {
        self.listStyle(.plain)
            .listSectionSeparator(.hidden)
            .listSectionSpacing(0)
            .scrollContentBackground(.hidden)
            .background(Color(.systemBackground))
    }

    func crmGlassSurface() -> some View {
        modifier(CRMGlassSurfaceModifier())
    }

    func crmAction(prominent: Bool = false) -> some View {
        modifier(CRMActionModifier(prominent: prominent))
    }

    @ViewBuilder func crmTabBehavior() -> some View {
        if #available(iOS 26.0, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }
}

private struct CRMActionModifier: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme
    let prominent: Bool

    @ViewBuilder func body(content: Content) -> some View {
        // Resolve the neutral accent explicitly. A contextual Color.primary
        // tint can retain its previous contrast inside native glass controls
        // when the system appearance changes while the screen is open.
        let ink: Color = colorScheme == .dark ? .white : .black
        let onInk: Color = colorScheme == .dark ? .black : .white
        let action = content.tint(ink).foregroundStyle(prominent ? onInk : ink)
        if #available(iOS 26.0, *), !reduceTransparency {
            if prominent {
                action.buttonStyle(.glassProminent).buttonBorderShape(.capsule)
            } else {
                action.buttonStyle(.glass).buttonBorderShape(.capsule)
            }
        } else if prominent {
            action.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
        } else {
            action.buttonStyle(.bordered).buttonBorderShape(.capsule)
        }
    }
}

struct CRMSectionTitle: View {
    let title: String
    var icon: String = ""
    var body: some View {
        Text(title)
            .font(.title3.weight(.bold))
            .foregroundStyle(Color(.label))
            .textCase(nil)
            .listRowInsets(EdgeInsets(top: 16, leading: 20, bottom: 4, trailing: 20))
            .listRowSeparator(.hidden)
            .accessibilityAddTraits(.isHeader)
    }
}

struct CRMQuietRow: View {
    let title: String
    let detail: String
    let icon: String
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon).font(.system(size: 20)).foregroundStyle(.secondary)
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.subheadline.weight(.medium))
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
        }.padding(.vertical, 12)
    }
}

struct CRMBrand: View {
    var size: CGFloat = 56
    var body: some View {
        Image("GocrmMark").resizable().scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.23, style: .continuous))
            .accessibilityHidden(true)
    }
}

// Glass belongs to controls. Content stays on the semantic white/black canvas.
private struct CRMGlassSurfaceModifier: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 26.0, *), !reduceTransparency {
            content.glassEffect(.regular, in: .capsule)
        } else {
            content.background(Color(.secondarySystemBackground), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(.separator), lineWidth: 0.5))
        }
    }
}

struct CRMWorkspaceToolbar: ToolbarContent {
    @EnvironmentObject var session: Session
    @ToolbarContentBuilder var body: some ToolbarContent {
        if #available(iOS 26.0, *) {
            ToolbarItem(placement: .topBarLeading) { workspaceLink }
                .sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarLeading) { workspaceLink }
        }
    }
    private var workspaceLink: some View {
        NavigationLink { SettingsView() } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text("gocrm").font(.headline.weight(.bold)).foregroundStyle(.primary)
                HStack(spacing: 5) {
                    Text(session.credentials?.workspace.name ?? "Tu empresa").lineLimit(1)
                    Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                }.font(.caption).foregroundStyle(.secondary)
            }
        }.accessibilityLabel("Empresa activa: \(session.credentials?.workspace.name ?? "Tu empresa"). Cambiar empresa")
    }
}

struct CRMSearchField: View {
    @Binding var text: String
    @FocusState private var focused: Bool
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass").font(.title3).accessibilityHidden(true)
            TextField("Nombre o correo", text: $text)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .submitLabel(.search).focused($focused).onSubmit { focused = false }
                .accessibilityIdentifier("contacts.search")
            if !text.isEmpty {
                Button { text = ""; focused = false } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                }.buttonStyle(.plain).accessibilityLabel("Borrar búsqueda")
            }
        }.padding(.leading, 18).padding(.trailing, text.isEmpty ? 18 : 4)
            .frame(minHeight: 48).crmGlassSurface()
    }
}
