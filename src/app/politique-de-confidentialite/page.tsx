import { LegalPageLayout } from "@/components/legal/legal-page-layout";

export const metadata = { title: "Politique de confidentialité — AttribMaster" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Politique de confidentialité" updatedAt="13 juillet 2026">
      <section>
        <h2>1. Qui sommes-nous</h2>
        <p>
          La présente politique de confidentialité décrit comment MLDIMO WEB, SASU au capital de 300 €,
          immatriculée au RCS de Nice sous le numéro 103 123 790, dont le siège social est situé 18 rue
          Alberti, 06000 Nice, France (ci-après « nous »), collecte et traite les données à caractère
          personnel des utilisateurs du service AttribMaster (ci-après « le Service »), en qualité de
          responsable de traitement au sens du Règlement général sur la protection des données (RGPD).
        </p>
      </section>

      <section>
        <h2>2. Données que nous collectons</h2>
        <p>Nous traitons les catégories de données suivantes :</p>
        <ul>
          <li>
            <strong>Données de compte :</strong> nom, adresse email, photo de profil (si connexion via
            Google), mot de passe (stocké de façon chiffrée si connexion par identifiants).
          </li>
          <li>
            <strong>Données d&apos;autorisation Google / BigQuery :</strong> jeton d&apos;actualisation
            (« refresh token ») OAuth chiffré (AES-256-GCM), permettant d&apos;accéder en ton nom aux
            données GA4/BigQuery du projet Google Cloud que tu connectes.
          </li>
          <li>
            <strong>Données d&apos;attribution :</strong> les données GA4/BigQuery elles-mêmes (identifiants
            pseudonymisés de visiteurs, sources/supports/campagnes marketing, horodatages, montants de
            transactions) restent hébergées dans ton propre projet BigQuery ; nous n&apos;en conservons en
            base qu&apos;un résumé agrégé nécessaire à l&apos;affichage des tableaux de bord.
          </li>
          <li>
            <strong>Données de facturation :</strong> nom du compte de facturation, identifiant client
            Stripe, plan souscrit et statut de l&apos;abonnement. Les moyens de paiement (numéro de carte,
            etc.) sont saisis et conservés exclusivement par Stripe ; nous n&apos;y avons jamais accès.
          </li>
          <li>
            <strong>Données de collaboration :</strong> adresses email des collaborateurs invités sur un
            projet.
          </li>
          <li>
            <strong>Données techniques :</strong> cookies de session nécessaires à l&apos;authentification,
            journaux techniques (adresse IP, horodatage, user-agent) à des fins de sécurité.
          </li>
          <li>
            <strong>Données de contact :</strong> nom, email, société et message si tu utilises notre
            formulaire de contact (par exemple pour une demande de plan Sur mesure).
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Finalités et bases légales du traitement</h2>
        <ul>
          <li>
            <strong>Fourniture du Service</strong> (création de compte, calcul et affichage des modèles
            d&apos;attribution, gestion des projets et des collaborateurs) : exécution du contrat.
          </li>
          <li>
            <strong>Facturation et gestion des abonnements</strong> via Stripe : exécution du contrat et
            obligations légales comptables.
          </li>
          <li>
            <strong>Sécurité du Service</strong> (prévention de la fraude, journaux techniques) : intérêt
            légitime.
          </li>
          <li>
            <strong>Réponse aux demandes de contact</strong> : consentement, matérialisé par l&apos;envoi du
            formulaire ou d&apos;un email.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Destinataires et sous-traitants</h2>
        <p>
          Tes données peuvent être transmises aux prestataires suivants, agissant en tant que
          sous-traitants pour les besoins strictement nécessaires au fonctionnement du Service :
        </p>
        <ul>
          <li>
            <strong>Google LLC</strong> (authentification OAuth, accès BigQuery/GA4).
          </li>
          <li>
            <strong>Vercel Inc.</strong> (hébergement de l&apos;application).
          </li>
          <li>
            <strong>Neon Inc.</strong> (hébergement de la base de données Postgres).
          </li>
          <li>
            <strong>Stripe Payments Europe, Ltd.</strong> (traitement des paiements et de la facturation).
          </li>
          <li>
            <strong>Resend, Inc.</strong> (envoi des emails transactionnels : confirmation d&apos;adresse,
            alertes liées à ton compte — infrastructure d&apos;envoi située dans l&apos;Union européenne).
          </li>
          <li>
            <strong>Functional Software, Inc. (Sentry)</strong> (surveillance des erreurs techniques de
            l&apos;application — données hébergées dans l&apos;Union européenne).
          </li>
        </ul>
        <p>
          Ces prestataires sont susceptibles de traiter des données en dehors de l&apos;Union européenne
          (notamment aux États-Unis), dans le cadre d&apos;un transfert encadré par des garanties appropriées
          (clauses contractuelles types de la Commission européenne ou mécanisme équivalent reconnu par le
          RGPD). Nous ne vendons ni ne louons tes données à des tiers.
        </p>
      </section>

      <section>
        <h2>5. Durée de conservation</h2>
        <ul>
          <li>
            Données de compte et de projet : conservées tant que le compte est actif, puis supprimées dans
            un délai raisonnable après la clôture du compte ou du projet, sauf obligation légale contraire.
          </li>
          <li>
            Jeton d&apos;autorisation BigQuery : supprimé immédiatement à la déconnexion du projet ou à la
            révocation de l&apos;accès par l&apos;utilisateur.
          </li>
          <li>
            Données de facturation : conservées conformément aux obligations comptables et fiscales
            légales (en principe 10 ans).
          </li>
          <li>Journaux techniques de sécurité : conservés 12 mois maximum.</li>
        </ul>
      </section>

      <section>
        <h2>6. Cookies</h2>
        <p>
          Le Service utilise uniquement des cookies strictement nécessaires à l&apos;authentification et au
          fonctionnement de la session utilisateur. Ces cookies ne nécessitent pas de consentement préalable
          au titre de la réglementation applicable, car ils sont indispensables à la fourniture du Service
          demandé par l&apos;utilisateur. Nous n&apos;utilisons pas de cookies publicitaires ou de traceurs
          tiers à des fins de mesure d&apos;audience marketing.
        </p>
      </section>

      <section>
        <h2>7. Tes droits</h2>
        <p>
          Conformément au RGPD, tu disposes des droits suivants sur tes données : accès, rectification,
          effacement, limitation du traitement, portabilité, opposition, ainsi que le droit de définir des
          directives relatives à leur sort après ton décès. Tu peux exercer ces droits à tout moment en nous
          écrivant à{" "}
          <a href="mailto:contact@attribmaster.com" className="font-medium text-primary hover:underline">
            contact@attribmaster.com
          </a>
          . Tu disposes également du droit d&apos;introduire une réclamation auprès de la Commission
          Nationale de l&apos;Informatique et des Libertés (CNIL, www.cnil.fr) si tu estimes que tes droits
          ne sont pas respectés.
        </p>
      </section>

      <section>
        <h2>8. Sécurité</h2>
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger tes
          données (chiffrement des jetons d&apos;accès sensibles, connexions HTTPS, hébergement chez des
          prestataires reconnus). Aucune méthode de transmission ou de stockage n&apos;étant sûre à 100 %,
          nous ne pouvons garantir une sécurité absolue.
        </p>
      </section>

      <section>
        <h2>9. Modification de la politique de confidentialité</h2>
        <p>
          Nous pouvons modifier la présente politique à tout moment, notamment pour refléter une évolution
          du Service ou de la réglementation applicable. La version en vigueur est celle publiée sur cette
          page, avec sa date de mise à jour.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Pour toute question relative à cette politique ou au traitement de tes données, écris-nous à{" "}
          <a href="mailto:contact@attribmaster.com" className="font-medium text-primary hover:underline">
            contact@attribmaster.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
