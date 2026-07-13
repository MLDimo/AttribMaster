import { LegalPageLayout } from "@/components/legal/legal-page-layout";

export const metadata = { title: "CGV — AttribMaster" };

export default function CgvPage() {
  return (
    <LegalPageLayout title="Conditions Générales de Vente" updatedAt="13 juillet 2026">
      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes Conditions Générales de Vente (CGV) s&apos;appliquent à tout abonnement souscrit
          auprès de MLDIMO WEB, SASU immatriculée au RCS de Nice sous le numéro 103 123 790 (ci-après
          « nous ») pour l&apos;utilisation du service
          AttribMaster. Elles complètent nos{" "}
          <a href="/cgu" className="font-medium text-primary hover:underline">
            Conditions Générales d&apos;Utilisation
          </a>
          .
        </p>
      </section>

      <section>
        <h2>2. Principe : un projet, un abonnement</h2>
        <p>
          Chaque projet AttribMaster dispose de son propre abonnement, rattaché à un « compte de
          facturation ». Un compte de facturation peut être créé pour un seul projet ou réutilisé pour
          plusieurs projets d&apos;un même espace de travail — au choix de l&apos;utilisateur au moment de la
          souscription.
        </p>
      </section>

      <section>
        <h2>3. Plans et tarifs</h2>
        <ul>
          <li>Standard : 49 € / mois, jusqu&apos;à 100 000 sessions / mois.</li>
          <li>Pro : 99 € / mois, jusqu&apos;à 500 000 sessions / mois.</li>
          <li>Sur mesure : tarif à partir de 250 € / mois, établi sur devis selon les besoins.</li>
        </ul>
        <p>
          Les plafonds de sessions indiqués sont donnés à titre indicatif ; ils ne font l&apos;objet d&apos;aucune
          limitation technique automatique à ce jour. Si l&apos;usage constaté dépasse durablement le plan
          souscrit, nous pourrons proposer un passage vers un plan supérieur ou sur mesure.
        </p>
      </section>

      <section>
        <h2>4. Frais d&apos;installation</h2>
        <p>
          Un abonnement mensuel aux plans Standard ou Pro inclut des frais d&apos;installation uniques de
          50 €, couvrant la configuration complète de la connexion BigQuery (projet GCP, dataset GA4,
          table d&apos;attribution). Ces frais sont offerts pour tout abonnement facturé annuellement.
        </p>
      </section>

      <section>
        <h2>5. Facturation et paiement</h2>
        <p>
          Les paiements sont traités par Stripe. La facturation est mensuelle ou annuelle selon le choix
          de l&apos;utilisateur à la souscription. Le renouvellement est automatique jusqu&apos;à résiliation.
        </p>
      </section>

      <section>
        <h2>6. Résiliation</h2>
        <p>
          L&apos;utilisateur peut résilier son abonnement à tout moment, sans engagement, depuis son espace
          de facturation (portail Stripe). La résiliation prend effet à la fin de la période en cours
          déjà payée ; aucun remboursement au prorata n&apos;est effectué sauf disposition légale contraire.
        </p>
      </section>

      <section>
        <h2>7. Absence de droit de rétractation (clients professionnels)</h2>
        <p>
          Le Service étant souscrit par des professionnels dans le cadre de leur activité, le droit de
          rétractation prévu par le Code de la consommation ne s&apos;applique pas, conformément à
          l&apos;article L221-3 du Code de la consommation.
        </p>
      </section>

      <section>
        <h2>8. Plan Sur mesure</h2>
        <p>
          Le plan Sur mesure fait l&apos;objet d&apos;un devis et d&apos;un contrat spécifiques, négociés au cas par
          cas via le formulaire de contact du Service.
        </p>
      </section>

      <section>
        <h2>9. Modification des CGV</h2>
        <p>
          Nous pouvons modifier les présentes CGV à tout moment. Les utilisateurs seront informés de
          toute modification substantielle affectant leurs abonnements en cours.
        </p>
      </section>

      <section>
        <h2>10. Droit applicable</h2>
        <p>Les présentes CGV sont soumises au droit français. Tout litige relève des tribunaux compétents.</p>
      </section>
    </LegalPageLayout>
  );
}
