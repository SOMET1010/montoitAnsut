'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Mail, Phone, Clock, Send, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { toast } from '@/hooks/use-toast'

const contactInfo = [
  {
    icon: MapPin,
    label: 'Riviera Palmeraie, Abidjan, Côte d\'Ivoire',
  },
  {
    icon: Mail,
    label: 'contact@montoit.ci',
    href: 'mailto:contact@montoit.ci',
  },
  {
    icon: Phone,
    label: '+225 01 02 03 04 05',
    href: 'tel:+2250102030405',
  },
  {
    icon: Clock,
    label: 'Lun - Ven : 8h - 18h | Sam : 9h - 13h',
  },
]

const socialLinks = [
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
]

const faqItems = [
  {
    question: 'Comment créer un compte ?',
    answer:
      "Cliquez sur 'S'inscrire', entrez votre numéro de téléphone et validez avec le code OTP reçu par SMS.",
  },
  {
    question: 'Combien coûte la publication d\'une annonce ?',
    answer:
      'La publication d\'annonces est gratuite pour les propriétaires vérifiés.',
  },
  {
    question: 'Quel est le délai de validation ?',
    answer:
      'Notre Tiers de Confiance s\'engage à traiter chaque dossier sous 48h maximum.',
  },
]

const subjectOptions = [
  { value: 'information', label: 'Demande d\'information' },
  { value: 'publication', label: 'Publication d\'annonce' },
  { value: 'recherche', label: 'Recherche de logement' },
  { value: 'paiement', label: 'Problème de paiement' },
  { value: 'compte', label: 'Gestion du compte' },
  { value: 'signalement', label: 'Signaler un problème' },
  { value: 'kyc', label: 'Vérification KYC/ONECI' },
  { value: 'bail', label: 'Questions sur les baux' },
  { value: 'technique', label: 'Problème technique' },
  { value: 'partenariat', label: 'Partenariat commercial' },
  { value: 'reclamation', label: 'Réclamation' },
  { value: 'autre', label: 'Autre sujet' },
]

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800))

    toast({
      title: 'Message envoyé avec succès !',
      description: 'Nous vous répondrons dans les plus brefs délais.',
    })

    setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
    setIsSubmitting(false)
  }

  return (
    <section className="py-16 sm:py-20 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Nous Contacter
          </h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Une question, un besoin ? Notre équipe est à votre écoute pour vous accompagner.
          </p>
        </motion.div>

        {/* Layout: 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Left - Contact Form (3 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-3"
          >
            <div className="bg-card rounded-xl border border-border p-6 sm:p-8 shadow-sm">
              <h3 className="text-xl font-bold text-foreground mb-6">
                Envoyez-nous un message
              </h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Nom complet</Label>
                  <Input
                    id="contact-name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    className="h-11 bg-muted border-border focus-visible:border-brand-500 focus-visible:ring-brand-500/30"
                  />
                </div>

                {/* Email + Phone row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="jean@exemple.ci"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                      className="h-11 bg-muted border-border focus-visible:border-brand-500 focus-visible:ring-brand-500/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Téléphone</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="01 23 45 67 89"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="h-11 bg-muted border-border focus-visible:border-brand-500 focus-visible:ring-brand-500/30"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <Label htmlFor="contact-subject">Sujet</Label>
                  <Select value={formData.subject} onValueChange={(val) => handleChange('subject', val)}>
                    <SelectTrigger className="w-full data-[size=default]:h-11 bg-muted border-border">
                      <SelectValue placeholder="Sélectionnez un sujet" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Décrivez votre demande..."
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    required
                    className="bg-muted border-border focus-visible:border-brand-500 focus-visible:ring-brand-500/30 min-h-[100px]"
                  />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi en cours...
                    </span>
                  ) : (
                    <>
                      Envoyer le message
                      <Send className="size-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Right - Contact Info (2 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Contact details card */}
            <div className="bg-muted rounded-xl border border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-5">
                Nos coordonnées
              </h3>
              <ul className="space-y-4">
                {contactInfo.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.label} className="flex items-start gap-3">
                      <div className="size-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="size-4 text-brand-500" />
                      </div>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="text-sm text-muted-foreground hover:text-brand-500 transition-colors pt-1.5"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground pt-1.5">
                          {item.label}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Social links */}
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-3">Suivez-nous</p>
                <div className="flex items-center gap-3">
                  {socialLinks.map((social) => {
                    const Icon = social.icon
                    return (
                      <a
                        key={social.label}
                        href={social.href}
                        aria-label={social.label}
                        className="size-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-brand-500 hover:border-brand-500 hover:text-white text-muted-foreground transition-colors"
                      >
                        <Icon className="size-4" />
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mini FAQ */}
            <div className="bg-muted rounded-xl border border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Questions fréquentes
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm text-left text-foreground hover:text-brand-500 hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
