import { LegalPageLayout } from "@/components/legal/legal-page-layout";

export const metadata = { title: "CGU — AttribMaster" };

export default function CguPage() {
  return (
    <LegalPageLayout title="Conditions Générales d'Utilisation" updatedAt="13 juillet 2026">
      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation
          du service AttribMaster (ci-après « le Service »), édité par MLDIMO WEB, SAS immatriculée au
          RCS de Nice sous le numéro 103 123 790 (ci-après « nous », « l&apos;Éditeur »). L&apos;utilisation du
          Service implique l&apos;acceptation pleine et entière des présentes CGU.
        </p>
      </section>

      <section>
        <h2>2. Description du Service</h2>
        <p>
          AttribMaster est un outil d&apos;attribution marketing multi-touch : il se connecte aux exports
          Google Analytics 4 (GA4) d&apos;un utilisateur, hébergés sur Google BigQuery, via une autorisation
          OAuth Google accordée par l&apos;utilisateur, afin de calculer et d&apos;afficher des modèles
          d&apos;attribution (Last Click, Linéaire, Croissant, En U, Chaînes de Markov, Valeur de Shapley)
          sur les données de conversion de l&apos;utilisateur.
        </p>
      </section>

      <section>
        <h2>3. Accès au Service et compte utilisateur</h2>
        <p>
          L&apos;accès au Service nécessite la création d&apos;un compte (connexion Google ou email/mot de
          passe). L&apos;utilisateur est responsable de la confidentialité de ses identifiants et de toute
          activité effectuée depuis son compte. L&apos;accès aux fonctionnalités complètes d&apos;un projet
          nécessite en outre un abonnement actif (voir nos{" "}
          <a href="/cgv" className="font-medium text-primary hover:underline">
            Conditions Générales de Vente
          </a>
          ).
        </p>
      </section>

      <section>
        <h2>4. Autorisation d&apos;accès à BigQuery</h2>
        <p>
          En connectant un projet à BigQuery, l&apos;utilisateur autorise l&apos;Éditeur à accéder en lecture
          (et en écriture, pour la table de résumé d&apos;attribution) aux données du projet Google Cloud
          désigné, dans la seule mesure nécessaire au fonctionnement du Service. Cette autorisation est
          révocable à tout moment depuis les paramètres du compte Google de l&apos;utilisateur ou depuis le
          Service.
        </p>
      </section>

      <section>
        <h2>5. Collaborateurs et comptes multi-utilisateurs</h2>
        <p>
          Un utilisateur peut inviter d&apos;autres personnes à collaborer sur un projet. L&apos;utilisateur
          qui invite un collaborateur est responsable de s&apos;assurer qu&apos;il est autorisé à partager
          l&apos;accès aux données concernées.
        </p>
      </section>

      <section>
        <h2>6. Obligations de l&apos;utilisateur</h2>
        <ul>
          <li>Fournir des informations exactes lors de la création du compte.</li>
          <li>Ne pas utiliser le Service à des fins illicites ou frauduleuses.</li>
          <li>Ne pas tenter de contourner les mesures de sécurité du Service.</li>
          <li>Respecter les droits des tiers dont les données pourraient transiter par le Service.</li>
        </ul>
      </section>

      <section>
        <h2>7. Disponibilité et responsabilité</h2>
        <p>
          L&apos;Éditeur s&apos;efforce d&apos;assurer une disponibilité continue du Service mais ne garantit pas
          une disponibilité sans interruption. L&apos;Éditeur ne saurait être tenu responsable des
          conséquences d&apos;une indisponibilité de services tiers (Google, BigQuery, Stripe) dont dépend
          le Service.
        </p>
      </section>

      <section>
        <h2>8. Propriété intellectuelle</h2>
        <p>
          Le Service, son interface et sa marque restent la propriété exclusive de l&apos;Éditeur. Les
          données de l&apos;utilisateur (données GA4/BigQuery, transactions calculées) restent la propriété
          de l&apos;utilisateur.
        </p>
      </section>

      <section>
        <h2>9. Modification des CGU</h2>
        <p>
          L&apos;Éditeur peut modifier les présentes CGU à tout moment. Les utilisateurs seront informés de
          toute modification substantielle.
        </p>
      </section>

      <section>
        <h2>10. Droit applicable</h2>
        <p>Les présentes CGU sont soumises au droit français. Tout litige relève des tribunaux compétents.</p>
      </section>
    </LegalPageLayout>
  );
}
