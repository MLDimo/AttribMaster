import { LegalPageLayout } from "@/components/legal/legal-page-layout";

export const metadata = { title: "Mentions légales — AttribMaster" };

export default function MentionsLegalesPage() {
  return (
    <LegalPageLayout title="Mentions légales" updatedAt="[À COMPLÉTER]">
      <section>
        <h2>Éditeur du site</h2>
        <p>
          Le site AttribMaster (ci-après « le Site ») est édité par :
          <br />
          [Raison sociale à compléter], [forme juridique, ex : SASU] au capital de [montant] €
          <br />
          Siège social : [adresse à compléter]
          <br />
          RCS [ville] [numéro] — SIRET [numéro]
          <br />
          Numéro de TVA intracommunautaire : [numéro]
          <br />
          Directeur de la publication : [nom à compléter]
          <br />
          Contact : [email à compléter]
        </p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Le Site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
          <br />
          La base de données est hébergée par Neon Inc. (Vercel Postgres).
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus du Site (textes, graphismes, logo, interface) est protégé par le droit
          de la propriété intellectuelle. Toute reproduction non autorisée est interdite.
        </p>
      </section>

      <section>
        <h2>Données personnelles</h2>
        <p>
          Le traitement des données personnelles est décrit dans nos{" "}
          <a href="/cgu" className="font-medium text-primary hover:underline">
            Conditions Générales d&apos;Utilisation
          </a>
          . Pour exercer tes droits (accès, rectification, suppression), contacte-nous à [email à compléter].
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Pour toute question relative au Site, écris-nous à [email à compléter].</p>
      </section>
    </LegalPageLayout>
  );
}
