'use client'

import { motion } from 'framer-motion'
import {
  BookOpen, FileText, Award, GraduationCap, HelpCircle,
  ChevronDown, ExternalLink, Clock, Zap, CheckCircle2,
  ShieldCheck, Building2, User, MapPin, AlertTriangle,
  CreditCard, Key, ClipboardCheck, Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

// ─── Static Data ────────────────────────────────────────────────────────────

const verificationGuides = [
  {
    id: 'property-verification',
    title: 'Vérification de propriété',
    icon: Building2,
    steps: [
      'Vérifier l\'identité du propriétaire (CNI ou passeport)',
      'Confirmer la propriété via le titre foncier ou l\'acte notarié',
      'Vérifier la concordance entre l\'adresse du bien et les documents',
      'Contrôler les diagnostics immobiliers (DPE, amiante, plomb, gaz)',
      'Photographier le bien et comparer avec les photos de l\'annonce',
      'Rédiger le rapport de vérification et soumettre au TC',
    ],
  },
  {
    id: 'inventory-report',
    title: 'État des lieux',
    icon: ClipboardCheck,
    steps: [
      'Se présenter au locataire et au propriétaire avec la convocation',
      'Parcourir chaque pièce selon la grille standardisée (9 postes × 5 colonnes)',
      'Évaluer l\'état : BON ou MAUVAIS pour chaque élément de chaque pièce',
      'Compter les clés remises (portes d\'entrée, boîtes aux lettres, etc.)',
      'Rédiger les observations particulières pour chaque poste',
      'Faire signer le rapport par le propriétaire et le locataire',
    ],
  },
  {
    id: 'document-validation',
    title: 'Validation des documents locataires',
    icon: FileText,
    steps: [
      'Vérifier la cohérence entre les informations du dossier et les documents fournis',
      'Contrôler l\'authenticité des pièces d\'identité (CNI / Passeport)',
      'Valider les justificatifs de revenus (fiches de paie, contrats de travail)',
      'Vérifier les garanties (garant, revenus du garant)',
      'Contrôler les justificatifs de domicile',
      'Valider ou rejeter le dossier avec commentaires',
    ],
  },
  {
    id: 'oneci-verification',
    title: 'Vérification ONECI',
    icon: ShieldCheck,
    steps: [
      'Accéder au portail ONECI avec les identifiants TC',
      'Saisir le numéro NNI du locataire ou du propriétaire',
      'Vérifier les informations : état civil, nationalité, résidence',
      'Comparer les données ONECI avec le dossier locataire',
      'En cas de divergence, signaler une alerte fraude potentielle',
      'Enregistrer le résultat de la vérification dans le dossier',
    ],
  },
]

const documentTypes = [
  {
    category: 'Pièces d\'identité',
    icon: User,
    documents: [
      { type: 'CNI', description: 'Carte Nationale d\'Identité — document principal d\'identification' },
      { type: 'Passeport', description: 'Passeport en cours de validité — accepté comme pièce d\'identité' },
      { type: 'GUARANTOR_ID', description: 'Pièce d\'identité du garant — CNI ou passeport' },
    ],
  },
  {
    category: 'Justificatifs de revenus',
    icon: CreditCard,
    documents: [
      { type: 'Fiche de paie', description: 'Les 3 derniers bulletins de salaire — obligatoire pour salariés' },
      { type: 'Contrat de travail', description: 'CDI, CDD ou contrat freelance — preuve d\'emploi' },
      { type: 'Attestation de travail', description: 'Certificat de l\'employeur confirmant l\'emploi' },
      { type: 'Relevé bancaire', description: 'Les 3 derniers relevés — preuve de ressources financières' },
      { type: 'RCCM', description: 'Registre du Commerce — obligatoire pour entrepreneurs' },
      { type: 'Déclaration fiscale', description: 'Dernière déclaration d\'impôts — pour travailleurs indépendants' },
      { type: 'GUARANTOR_INCOME_PROOF', description: 'Justificatif de revenus du garant' },
    ],
  },
  {
    category: 'Justificatifs de domicile',
    icon: MapPin,
    documents: [
      { type: 'Justificatif de domicile', description: 'Facture CIE/SODECI, quittance de loyer de moins de 3 mois' },
      { type: 'Attestation d\'hébergement', description: 'Attestation parentale — pour les étudiants hébergés' },
      { type: 'Facture CIE/SODECI', description: 'Facture d\'électricité ou d\'eau du bien' },
    ],
  },
  {
    category: 'Documents d\'études',
    icon: GraduationCap,
    documents: [
      { type: 'Certificat de scolarité', description: 'Attestation d\'inscription dans un établissement — pour étudiants' },
      { type: 'Attestation de bourse', description: 'Justificatif de bourse d\'études — pour étudiants boursiers' },
    ],
  },
  {
    category: 'Documents de propriété',
    icon: Building2,
    documents: [
      { type: 'Titre de propriété', description: 'Titre foncier ou acte de propriété officiel' },
      { type: 'RIB', description: 'Relevé d\'Identité Bancaire — pour les virements de loyer' },
    ],
  },
]

const certificationCriteria = [
  {
    type: 'USER_IDENTITY',
    label: 'Certification Identité',
    icon: User,
    color: 'text-brand-500',
    bgColor: 'bg-brand-50',
    criteria: [
      'Pièce d\'identité valide (CNI ou passeport) vérifiée',
      'Vérification ONECI réussie (concordance des données)',
      'Photo de profil correspondant à la pièce d\'identité',
      'Numéro de téléphone vérifié',
      'Adresse email vérifiée',
    ],
  },
  {
    type: 'PROPERTY',
    label: 'Certification Propriété',
    icon: Building2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    criteria: [
      'Titre de propriété ou acte notarié validé par le TC',
      'Visite de vérification terrain effectuée (mission complétée)',
      'Diagnostics immobiliers conformes (DPE, amiante, plomb, gaz)',
      'Photos du bien conformes à la réalité (vérifiées sur place)',
      'Adresse exacte vérifiée et confirmée',
      'Le bien respecte les normes d\'habitabilité minimales',
    ],
  },
  {
    type: 'AGENCY',
    label: 'Certification Agence',
    icon: ShieldCheck,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    criteria: [
      'RCCM (Registre du Commerce) valide et vérifié',
      'Agrement ou licence professionnelle en cours de validité',
      'Au moins 3 biens publiés et vérifiés sur la plateforme',
      'Aucun litige non résolu en cours',
      'Siège social ou bureau physique vérifié',
      'Réputation satisfaisante (taux de résolution des litiges > 80%)',
    ],
  },
]

const trainingModules = [
  {
    id: 'verification-basics',
    title: 'Bases de la vérification',
    description: 'Apprenez les fondamentaux de la vérification immobilière : protocoles, documents et bonnes pratiques.',
    duration: '2h30',
    difficulty: 'Débutant',
    difficultyColor: 'bg-green-100 text-green-700',
    icon: Eye,
    modules: 5,
  },
  {
    id: 'inventory-mastery',
    title: 'Maîtrise de l\'état des lieux',
    description: 'Maîtrisez la grille d\'état des lieux standardisée et la rédaction de rapports professionnels.',
    duration: '3h00',
    difficulty: 'Intermédiaire',
    difficultyColor: 'bg-amber-100 text-amber-700',
    icon: ClipboardCheck,
    modules: 8,
  },
  {
    id: 'fraud-detection',
    title: 'Détection de fraude',
    description: 'Identifiez les signaux d\'alerte et les techniques de fraude courantes dans les dossiers locatifs.',
    duration: '2h00',
    difficulty: 'Avancé',
    difficultyColor: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
    modules: 6,
  },
  {
    id: 'document-expertise',
    title: 'Expertise documentaire',
    description: 'Devenez expert en validation de documents : CNI, passeports, justificatifs, et détection de faux.',
    duration: '3h30',
    difficulty: 'Avancé',
    difficultyColor: 'bg-red-100 text-red-700',
    icon: FileText,
    modules: 7,
  },
  {
    id: 'legal-framework',
    title: 'Cadre juridique',
    description: 'Comprenez le cadre légal de la location en Côte d\'Ivoire : lois, décrets et obligations.',
    duration: '2h00',
    difficulty: 'Intermédiaire',
    difficultyColor: 'bg-amber-100 text-amber-700',
    icon: Award,
    modules: 4,
  },
  {
    id: 'communication-skills',
    title: 'Communication professionnelle',
    description: 'Améliorez vos compétences relationnelles avec les propriétaires, locataires et agents.',
    duration: '1h30',
    difficulty: 'Débutant',
    difficultyColor: 'bg-green-100 text-green-700',
    icon: Key,
    modules: 3,
  },
]

const faqItems = [
  {
    question: 'Que faire si le propriétaire refuse la visite de vérification ?',
    answer: 'Si un propriétaire refuse l\'accès au bien pour la vérification, signalez-le immédiatement via le système d\'alerte fraude. Le bien sera suspendu de la plateforme jusqu\'à résolution. Documentez le refus avec la date, l\'heure et le moyen de communication utilisé.',
  },
  {
    question: 'Comment gérer un dossier avec des documents expirés ?',
    answer: 'Les documents expirés doivent être rejetés avec le motif "Document expiré". Informez le locataire qu\'il doit fournir un document en cours de validité. Les fiches de paie de plus de 3 mois sont considérées comme expirées.',
  },
  {
    question: 'Un locataire peut-il avoir plusieurs garants ?',
    answer: 'Non, un seul garant est accepté par dossier locataire. Le garant doit fournir sa pièce d\'identité et un justificatif de revenus. Si le garant ne satisfait pas les critères, le dossier peut être rejeté ou le locataire peut proposer un autre garant.',
  },
  {
    question: 'Comment différencier un vrai titre foncier d\'un faux ?',
    answer: 'Vérifiez les éléments suivants : filigrane de sécurité, numéro d\'enregistrement, cachet officiel, et cohérence des informations avec le cadastre. En cas de doute, contactez les services fonciers pour vérification. Signalez toute suspicion de faux document.',
  },
  {
    question: 'Que faire en cas de divergence entre les informations ONECI et le dossier ?',
    answer: 'Toute divergence entre les données ONECI et le dossier constitue un signal d\'alerte. Marquez le dossier en "Information requise" et demandez au locataire de corriger. Si la divergence porte sur l\'identité (nom, date de naissance), signalez une alerte fraude.',
  },
  {
    question: 'Quels sont les délais SLA pour le traitement des dossiers ?',
    answer: 'Les SLA sont : 48h pour la vérification de propriété, 24h pour la validation de documents locataires, 72h pour les certifications, et 48h pour la résolution de litiges. Les retards sont automatiquement signalés dans le suivi SLA.',
  },
  {
    question: 'Comment rédiger un rapport d\'état des lieux complet ?',
    answer: 'Utilisez la grille standardisée à 9 postes (sol, peinture murs, peinture plafonds, portes, électricité, robinetterie, évier/lavabo, douche/SDB, clés). Évaluez chaque élément pour chaque pièce (cuisine, SDB principale, autres). Ajoutez des observations détaillées pour chaque anomalie.',
  },
  {
    question: 'Un agent peut-il refuser une mission ?',
    answer: 'Un agent peut signaler un conflit d\'intérêt (ex: lien avec le propriétaire) et demander un remplacement. Cependant, les missions ne peuvent pas être refusées sans motif valable. L\'agent doit informer le TC dans les plus brefs délais pour réaffectation.',
  },
  {
    question: 'Comment gérer un litige entre locataire et propriétaire ?',
    answer: 'Prenez en charge le litige via la section dédiée. Documentez les réclamations des deux parties. Proposez une médiation. Si aucun accord n\'est trouvé, escaladez vers l\'administration avec un rapport détaillé. Gardez une trace de toutes les communications.',
  },
  {
    question: 'Quand doit-on déclencher une alerte fraude ?',
    answer: 'Déclenchez une alerte fraude si vous constatez : documents falsifiés, identité usurpée, bien fictif, propriétaire imposteur, ou toute manipulation visant à tromper la plateforme. Utilisez le système d\'alerte fraude pour blocage immédiat et investigation.',
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function DocumentationCenter() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
            <BookOpen className="size-6 text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Centre de documentation</h1>
            <p className="text-muted-foreground mt-0.5">Guides, formations et ressources pour les Tiers de Confiance</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <BookOpen className="size-3 mr-1" /> {verificationGuides.length} guides
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            <GraduationCap className="size-3 mr-1" /> {trainingModules.length} formations
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            <HelpCircle className="size-3 mr-1" /> {faqItems.length} FAQ
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="guides" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="guides" className="text-xs sm:text-sm gap-1.5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BookOpen className="size-4 shrink-0" />
            <span className="hidden sm:inline">Guides</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm gap-1.5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="size-4 shrink-0" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger value="certification" className="text-xs sm:text-sm gap-1.5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Award className="size-4 shrink-0" />
            <span className="hidden sm:inline">Certification</span>
          </TabsTrigger>
          <TabsTrigger value="formation" className="text-xs sm:text-sm gap-1.5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <GraduationCap className="size-4 shrink-0" />
            <span className="hidden sm:inline">Formation</span>
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs sm:text-sm gap-1.5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <HelpCircle className="size-4 shrink-0" />
            <span className="hidden sm:inline">FAQ</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Guides Tab (US-TA-100) ──────────────────────────────── */}
        <TabsContent value="guides" className="space-y-4">
          <Accordion type="multiple" className="space-y-3">
            {verificationGuides.map((guide) => {
              const Icon = guide.icon
              return (
                <AccordionItem
                  key={guide.id}
                  value={guide.id}
                  className="border rounded-lg px-4 bg-background"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                        <Icon className="size-5 text-brand-500" />
                      </div>
                      <span className="font-semibold text-foreground">{guide.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <ol className="space-y-3 ml-2">
                      {guide.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-sm text-foreground pt-1">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </TabsContent>

        {/* ─── Documents Tab (US-TA-101) ───────────────────────────── */}
        <TabsContent value="documents" className="space-y-4">
          {documentTypes.map((category, cIdx) => {
            const Icon = category.icon
            return (
              <Card key={cIdx} className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="size-5 text-brand-500" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left font-medium text-muted-foreground p-2.5">Type de document</th>
                          <th className="text-left font-medium text-muted-foreground p-2.5">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.documents.map((doc, dIdx) => (
                          <tr key={dIdx} className="border-b border-border last:border-0">
                            <td className="p-2.5">
                              <Badge variant="outline" className="font-medium text-foreground">
                                {doc.type}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-muted-foreground">{doc.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* ─── Certification Tab (US-TA-102) ───────────────────────── */}
        <TabsContent value="certification" className="space-y-4">
          {certificationCriteria.map((cert) => {
            const Icon = cert.icon
            return (
              <Card key={cert.type} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', cert.bgColor)}>
                      <Icon className={cn('size-5', cert.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{cert.label}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Conditions requises pour l&apos;obtention
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {cert.criteria.map((criterion, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className={cn('size-4 shrink-0 mt-0.5', cert.color)} />
                        <p className="text-sm text-foreground">{criterion}</p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* ─── Formation Tab (US-TA-103) ───────────────────────────── */}
        <TabsContent value="formation" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {trainingModules.map((module) => {
              const Icon = module.icon
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-border h-full flex flex-col hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                          <Icon className="size-5 text-brand-500" />
                        </div>
                        <Badge className={cn('text-[10px] shrink-0', module.difficultyColor)}>
                          {module.difficulty}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-2">{module.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <p className="text-sm text-muted-foreground flex-1">{module.description}</p>
                      <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {module.duration}
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="size-3.5" />
                          {module.modules} modules
                        </div>
                      </div>
                      <Button
                        className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                        size="sm"
                        onClick={() => {
                          // Placeholder — no actual navigation
                        }}
                      >
                        <Zap className="size-3.5" />
                        Commencer
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </TabsContent>

        {/* ─── FAQ Tab (US-TA-104) ─────────────────────────────────── */}
        <TabsContent value="faq" className="space-y-4">
          <Accordion type="multiple" className="space-y-3">
            {faqItems.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="border rounded-lg px-4 bg-background"
              >
                <AccordionTrigger className="hover:no-underline py-4 text-left">
                  <div className="flex items-center gap-3 text-left">
                    <HelpCircle className="size-4 text-brand-500 shrink-0" />
                    <span className="font-medium text-foreground text-sm">{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="text-sm text-muted-foreground pl-7">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
