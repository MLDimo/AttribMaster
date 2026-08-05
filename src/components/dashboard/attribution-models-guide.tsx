import { BookOpen, SlidersHorizontal } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomModelBuilder } from "@/components/dashboard/custom-model-builder";
import type { CustomModelConfig } from "@/lib/attribution/types";

type ModelExplanation = {
  id: string;
  label: string;
  calcul: string;
  utile: string;
};

const MODEL_EXPLANATIONS: ModelExplanation[] = [
  {
    id: "last_click",
    label: "Last Click",
    calcul: "100 % du revenu est attribué au dernier point de contact avant l'achat.",
    utile: "Parcours courts, ou pour isoler ce qui déclenche l'achat au moment T.",
  },
  {
    id: "linear",
    label: "Linéaire",
    calcul: "Le revenu est réparti à parts strictement égales entre tous les touchpoints du parcours.",
    utile: "Parcours modérément complexes, quand chaque interaction compte autant que les autres.",
  },
  {
    id: "time_decay",
    label: "Croissant",
    calcul:
      "Le poids augmente à mesure qu'on se rapproche de l'achat (décroissance exponentielle, demi-vie de 7 jours).",
    utile: "Cycles de vente longs (B2B) où les dernières interactions sont les plus décisives.",
  },
  {
    id: "u_shape",
    label: "En U",
    calcul: "40 % au premier contact, 40 % au dernier, les 20 % restants répartis entre les touchpoints du milieu.",
    utile: "Valoriser à la fois la découverte (1er contact) et la conversion (dernier contact).",
  },
  {
    id: "markov",
    label: "Chaînes de Markov",
    calcul:
      "Le parcours est modélisé comme un graphe de transitions probabilistes entre canaux. L'importance d'un canal = son \"removal effect\" (la chute de probabilité de conversion si on le retire du graphe).",
    utile: "Gros volumes de données, pour capter les enchaînements réels entre canaux sans poids arbitraire.",
  },
  {
    id: "shapley",
    label: "Valeur de Shapley",
    calcul:
      "Issu de la théorie des jeux : chaque combinaison de canaux d'une conversion est une \"coalition\", et la valeur de Shapley mesure la contribution marginale moyenne de chaque canal sur tous les ordres possibles.",
    utile: "Capter les synergies entre canaux (ex: display + retargeting convertissent mieux ensemble).",
  },
];

export function AttributionModelsGuide({
  projectId,
  customModelConfig,
  canManageCustomModel,
  onCustomModelSaved,
}: {
  projectId: string;
  customModelConfig: CustomModelConfig | null;
  canManageCustomModel: boolean;
  onCustomModelSaved: (config: CustomModelConfig | null) => void;
}) {
  return (
    <Card className="h-fit w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" />
          Modèles d&apos;attribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="guide">
          <TabsList className="w-full">
            <TabsTrigger value="guide">Guide</TabsTrigger>
            <TabsTrigger value="custom" className="gap-1">
              <SlidersHorizontal className="size-3.5" />
              Mon modèle
            </TabsTrigger>
          </TabsList>
          <TabsContent value="guide">
            <Accordion type="single" collapsible className="w-full">
              {MODEL_EXPLANATIONS.map((model) => (
                <AccordionItem key={model.id} value={model.id}>
                  <AccordionTrigger>{model.label}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Calcul : </span>
                        {model.calcul}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Utile pour : </span>
                        {model.utile}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
          <TabsContent value="custom" className="pt-1">
            <CustomModelBuilder
              projectId={projectId}
              config={customModelConfig}
              canManage={canManageCustomModel}
              onSaved={onCustomModelSaved}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
