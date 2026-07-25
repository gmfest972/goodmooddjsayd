import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  fr: {
    translation: {
      nav: { catalogue: "Catalogue", tour: "Tour", merch: "Store", newsletter: "Newsletter", admin: "Admin" },
      hero: {
        line1: "GOOD",
        line2: "MOOD",
        tag: "DJ SAYD — LIVE & RECORDS",
        cta: "REJOINDRE",
        scroll: "SCROLL",
      },
      catalogue: {
        title: "CATALOGUE",
        subtitle: "9 VOLUMES — PARIS • CARAÏBES • MONDE",
        listen: "ÉCOUTER",
        volume: "VOL.",
      },
      tour: {
        title: "LIVE EXPERIENCE",
        subtitle: "PARIS • CARAÏBES • MONDE",
        tickets: "BILLETS",
        soldout: "COMPLET",
        soon: "BIENTÔT",
      },
      merch: {
        title: "STORE",
        subtitle: "DROPS · ÉDITIONS LIMITÉES",
        drop: "DROP",
        size: "TAILLE",
        qty: "QUANTITÉ",
        total: "TOTAL",
        buy: "COMMANDER",
      },
      newsletter: {
        title: "REJOINDRE LE MOUVEMENT",
        subtitle: "Sois averti des sorties, dates et drops exclusifs.",
        placeholder: "ton email",
        submit: "S'ABONNER",
        success: "Tu es dans la boucle.",
        already: "Déjà abonné — bienvenue.",
        error: "Erreur — réessaie.",
      },
      footer: { rights: "© 2026 GOOD MOOD. Tous droits réservés." },
      admin: {
        title: "Good Mood — Admin",
        login: "Connexion",
        email: "Email",
        password: "Mot de passe",
        signin: "Se connecter",
        logout: "Déconnexion",
        catalogue: "Catalogue",
        tour: "Tour",
        newsletter: "Newsletter",
        add: "Ajouter",
        save: "Enregistrer",
        cancel: "Annuler",
        edit: "Modifier",
        delete: "Supprimer",
        export: "Exporter CSV",
        confirm: "Confirmer la suppression ?",
      },
    },
  },
  en: {
    translation: {
      nav: { catalogue: "Catalogue", tour: "Tour", merch: "Store", newsletter: "Newsletter", admin: "Admin" },
      hero: { line1: "GOOD", line2: "MOOD", tag: "DJ SAYD — LIVE & RECORDS", cta: "JOIN IN", scroll: "SCROLL" },
      catalogue: { title: "CATALOGUE", subtitle: "9 VOLUMES — PARIS • CARIBBEAN • WORLD", listen: "LISTEN", volume: "VOL." },
      tour: { title: "LIVE EXPERIENCE", subtitle: "PARIS • CARIBBEAN • WORLD", tickets: "TICKETS", soldout: "SOLD OUT", soon: "SOON" },
      merch: { title: "STORE", subtitle: "DROPS · LIMITED PIECES", drop: "DROP", size: "SIZE", qty: "QUANTITY", total: "TOTAL", buy: "BUY NOW" },
      newsletter: {
        title: "JOIN THE MOVEMENT",
        subtitle: "Get notified about releases, dates and exclusive drops.",
        placeholder: "your email",
        submit: "SUBSCRIBE",
        success: "You're in the loop.",
        already: "Already subscribed — welcome back.",
        error: "Something went wrong — try again.",
      },
      footer: { rights: "© 2026 GOOD MOOD. All rights reserved." },
      admin: {
        title: "Good Mood — Admin", login: "Sign in", email: "Email", password: "Password",
        signin: "Sign in", logout: "Log out", catalogue: "Catalogue", tour: "Tour", newsletter: "Newsletter",
        add: "Add", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete", export: "Export CSV",
        confirm: "Confirm delete?",
      },
    },
  },
  es: {
    translation: {
      nav: { catalogue: "Catálogo", tour: "Gira", merch: "Tienda", newsletter: "Newsletter", admin: "Admin" },
      hero: { line1: "GOOD", line2: "MOOD", tag: "DJ SAYD — LIVE & RECORDS", cta: "UNIRSE", scroll: "SCROLL" },
      catalogue: { title: "CATÁLOGO", subtitle: "9 VOLÚMENES — PARIS • CARIBE • MUNDO", listen: "ESCUCHAR", volume: "VOL." },
      tour: { title: "LIVE EXPERIENCE", subtitle: "PARIS • CARIBE • MUNDO", tickets: "ENTRADAS", soldout: "AGOTADO", soon: "PRONTO" },
      merch: { title: "TIENDA", subtitle: "DROPS · PIEZAS LIMITADAS", drop: "DROP", size: "TALLA", qty: "CANTIDAD", total: "TOTAL", buy: "COMPRAR" },
      newsletter: {
        title: "ÚNETE AL MOVIMIENTO",
        subtitle: "Recibe avisos de lanzamientos, fechas y drops exclusivos.",
        placeholder: "tu email",
        submit: "SUSCRIBIRSE",
        success: "Ya estás dentro.",
        already: "Ya suscrito — bienvenido.",
        error: "Error — intenta de nuevo.",
      },
      footer: { rights: "© 2026 GOOD MOOD. Todos los derechos reservados." },
      admin: {
        title: "Good Mood — Admin", login: "Acceso", email: "Email", password: "Contraseña",
        signin: "Entrar", logout: "Salir", catalogue: "Catálogo", tour: "Gira", newsletter: "Newsletter",
        add: "Añadir", save: "Guardar", cancel: "Cancelar", edit: "Editar", delete: "Eliminar", export: "Exportar CSV",
        confirm: "¿Confirmar eliminación?",
      },
    },
  },
  kr: {
    translation: {
      nav: { catalogue: "Katalòg", tour: "Toune", merch: "Boutik", newsletter: "Newsletter", admin: "Admin" },
      hero: { line1: "GOOD", line2: "MOOD", tag: "DJ SAYD — LIVE & DIS", cta: "ANTRE", scroll: "SCROLL" },
      catalogue: { title: "KATALÒG", subtitle: "9 VOLIM — PARIS • KARAYIB • LEMOND", listen: "KOUTE", volume: "VOL." },
      tour: { title: "LIVE EXPERIENCE", subtitle: "PARIS • KARAYIB • LEMOND", tickets: "BILÈ", soldout: "FINI", soon: "TALÈ" },
      merch: { title: "BOUTIK", subtitle: "DROPS · PYÈS LIMITE", drop: "DROP", size: "GWOSÈ", qty: "KANTITE", total: "TOTAL", buy: "ACHTE" },
      newsletter: {
        title: "ANTRE NAN MOUVMAN AN",
        subtitle: "Resevwa nouvèl sou sòti, dat ak drop eksklizif.",
        placeholder: "imel ou",
        submit: "ABONE",
        success: "Ou nan boukl la.",
        already: "Ou deja abone — byenveni.",
        error: "Yon erè — eseye ankò.",
      },
      footer: { rights: "© 2026 GOOD MOOD. Tout dwa rezève." },
      admin: {
        title: "Good Mood — Admin", login: "Konekte", email: "Imel", password: "Modpas",
        signin: "Antre", logout: "Dekonekte", catalogue: "Katalòg", tour: "Toune", newsletter: "Newsletter",
        add: "Ajoute", save: "Sove", cancel: "Anile", edit: "Modifye", delete: "Efase", export: "Ekspòte CSV",
        confirm: "Konfime efase?",
      },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem("gm_lang") || "fr",
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
  });

export default i18n;
