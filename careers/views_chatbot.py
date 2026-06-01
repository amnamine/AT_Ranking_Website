# careers/views_chatbot.py
import requests
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

@csrf_exempt
@require_http_methods(["POST"])
def chatbot_api(request):
    try:
        # Get user's message
        data = json.loads(request.body)
        user_message = data.get('message', '').lower().strip()
        
        # Get JWT token from session or request
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        # Define API base URL
        API_BASE = 'http://127.0.0.1:8000/api'
        
        # Headers for authenticated requests
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Process different types of questions
        response_text = process_question(user_message, API_BASE, headers)
        
        return JsonResponse({'response': response_text})
        
    except Exception as e:
        print(f"Chatbot error: {str(e)}")
        return JsonResponse({'response': 'Désolé, une erreur est survenue. Veuillez réessayer.'}, status=500)

def process_question(message, API_BASE, headers):
    """Process user question and fetch data from API"""
    
    # 1. Questions about job listings
    if any(word in message for word in ['postes', 'offres', 'emplois', 'jobs', 'disponible']):
        try:
            # Call your jobs API
            response = requests.get(f"{API_BASE}/jobs/", headers=headers, timeout=5)
            if response.status_code == 200:
                jobs = response.json()
                if jobs:
                    job_list = []
                    for job in jobs[:5]:  # Limit to 5 jobs
                        title = job.get('title', 'N/A')
                        location = job.get('location', 'N/A')
                        contract = job.get('contract_type', 'CDI')
                        job_list.append(f"• {title} - {location} ({contract})")
                    return "📋 **Voici nos offres d'emploi actuelles :**\n\n" + "\n".join(job_list) + "\n\nPour plus de détails, visitez notre page Offres d'emploi."
                else:
                    return "Aucune offre d'emploi n'est disponible pour le moment."
            else:
                return "Je n'ai pas pu récupérer les offres d'emploi. Veuillez réessayer plus tard."
        except Exception as e:
            print(f"API error: {e}")
            return "Désolé, je n'ai pas pu accéder aux offres d'emploi. Vérifiez que le serveur est en cours d'exécution."
    
    # 2. Questions about specific job
    elif any(word in message for word in ['ingenieur', 'developpeur', 'commercial', 'cybersecurite', 'projet']):
        try:
            # Get all jobs and filter
            response = requests.get(f"{API_BASE}/jobs/", headers=headers, timeout=5)
            if response.status_code == 200:
                jobs = response.json()
                # Find relevant job
                relevant_jobs = []
                for job in jobs:
                    job_title = job.get('title', '').lower()
                    if any(keyword in job_title for keyword in message.split()):
                        relevant_jobs.append(job)
                
                if relevant_jobs:
                    job = relevant_jobs[0]
                    return f"""✅ **{job.get('title', 'Poste')}**

📍 **Lieu:** {job.get('location', 'N/A')}
📄 **Type:** {job.get('contract_type', 'CDI')}
📅 **Publiée:** {job.get('published_date', 'Récemment')}

**Description:**
{job.get('description', 'Description non disponible')[:200]}...

**Compétences requises:**
{job.get('requirements', 'Voir détails sur la page')}

Pour postuler, cliquez sur 'Voir l'offre' sur notre site."""
                else:
                    return "Je n'ai pas trouvé de poste correspondant à votre recherche. Consultez notre page Offres d'emploi pour toutes les opportunités."
            else:
                return "Je n'ai pas pu accéder aux détails du poste. Veuillez réessayer."
        except Exception as e:
            print(f"API error: {e}")
            return "Désolé, je n'ai pas pu récupérer les détails du poste."
    
    # 3. Questions about location
    elif any(word in message for word in ['alger', 'oran', 'constantine', 'blida', 'location', 'localisation', 'ville']):
        try:
            response = requests.get(f"{API_BASE}/jobs/", headers=headers, timeout=5)
            if response.status_code == 200:
                jobs = response.json()
                # Extract location from message
                location = None
                for city in ['alger', 'oran', 'constantine', 'blida']:
                    if city in message:
                        location = city.capitalize()
                        break
                
                if location:
                    location_jobs = [job for job in jobs if location.lower() in job.get('location', '').lower()]
                    if location_jobs:
                        job_titles = [f"• {job['title']}" for job in location_jobs]
                        return f"📍 **Postes à {location}:**\n\n" + "\n".join(job_titles) + f"\n\n{len(location_jobs)} offre(s) disponible(s) à {location}."
                    else:
                        return f"Aucune offre d'emploi disponible à {location} pour le moment."
                else:
                    # Show all locations
                    locations = set([job.get('location', '') for job in jobs if job.get('location')])
                    if locations:
                        return f"📍 **Nos postes sont disponibles dans:**\n\n" + "\n".join([f"• {loc}" for loc in locations]) + "\n\nQuelle ville vous intéresse ?"
                    else:
                        return "Je n'ai pas trouvé d'informations sur les localisations."
            else:
                return "Je n'ai pas pu récupérer les informations de localisation."
        except Exception as e:
            print(f"API error: {e}")
            return "Désolé, je n'ai pas pu accéder aux informations de localisation."
    
    # 4. Questions about application process
    elif any(word in message for word in ['postuler', 'candidature', 'candidater', 'comment']):
        return """📝 **Comment postuler ?**

1. Rendez-vous sur notre page 'Offres d'emploi'
2. Choisissez l'offre qui vous intéresse
3. Cliquez sur 'Voir l'offre' puis 'Postuler'
4. Remplissez le formulaire de candidature en ligne
5. Joignez votre CV (format PDF)
6. Joignez votre lettre de motivation
7. Cliquez sur 'Envoyer'

Vous recevrez une confirmation par email.

Vous pouvez également déposer une candidature spontanée via notre formulaire de contact."""
    
    # 5. Questions about CV/documents
    elif any(word in message for word in ['cv', 'documents', 'lettre', 'motivation']):
        return """📄 **Documents requis pour postuler:**

• CV à jour (format PDF, max 2 Mo)
• Lettre de motivation (format PDF)
• Diplômes et certifications
• Pièce d'identité

Assurez-vous que tous les documents sont en français ou en anglais."""
    
    # 6. Questions about requirements (diploma, experience)
    elif any(word in message for word in ['diplome', 'diplôme', 'etude', 'étude', 'niveau']):
        return """🎓 **Niveau d'études requis:**

• **Postes d'ingénieur:** Bac+5 (Master, Diplôme d'ingénieur)
• **Postes techniques:** Bac+3 minimum
• **Management:** Bac+5 avec expérience
• **Commercial:** Bac+3 minimum

Les étudiants en dernière année peuvent également postuler pour les stages."""
    
    elif any(word in message for word in ['experience', 'expérience', 'anciennete']):
        return """⭐ **Expérience requise par poste:**

• **Ingénieur confirmé:** 3-5 ans d'expérience
• **Développeur:** 2-3 ans
• **Chef de projet:** 5+ ans
• **Commercial:** 2 ans minimum
• **Junior:** Débutants acceptés (avec formation)

Les profils exceptionnels avec moins d'expérience peuvent être considérés."""
    
    # 7. Questions about timeline
    elif any(word in message for word in ['delai', 'délai', 'temps', 'quand', 'combien']):
        return """⏰ **Délais de traitement:**

• **Réponse à votre candidature:** 2-3 semaines
• **Entretien:** Dans le mois suivant la présélection
• **Décision finale:** 6 semaines maximum

Nous vous tiendrons informé par email à chaque étape."""
    
    # 8. Questions about benefits
    elif any(word in message for word in ['salaire', 'avantages', 'benefice', 'prime', 'formation']):
        return """💰 **Rémunération et avantages:**

**Salaire:** Selon grille conventionnelle d'Algérie Télécom
**Avantages:**
• Mutuelle santé complète
• Tickets restaurant
• Transport pris en charge
• Prime de performance annuelle
• Formation continue et certifications
• Évolution professionnelle

Le salaire exact sera discuté lors de l'entretien selon votre profil."""
    
    # 9. Contact information
    elif any(word in message for word in ['contact', 'email', 'telephone', 'adresse']):
        return """📞 **Nous contacter:**

**Email:** recrutement@algerietelecom.dz
**Téléphone:** 01 23 45 67 89
**Adresse:** Algérie Télécom, Alger, Algérie

**Horaires:** Dimanche - Jeudi, 8h30 - 16h30"""
    
    # 10. General greeting
    elif any(word in message for word in ['bonjour', 'salut', 'hello', 'hi', 'coucou']):
        return """Bonjour ! 👋

Je suis l'assistant recrutement d'Algérie Télécom.

Je peux vous aider avec:
• 📋 Consulter nos offres d'emploi
• 📍 Postes par localisation
• 📝 Comment postuler
• 📄 Documents requis
• 🎓 Diplômes et expérience
• ⏰ Délais de traitement
• 💰 Avantages salariaux

Posez-moi votre question sur le recrutement !"""
    
    # Default response
    else:
        return """🤔 Je suis désolé, je ne peux répondre qu'aux questions sur le recrutement chez Algérie Télécom.

**Exemples de questions:**
• "Quels sont les postes disponibles ?"
• "Comment postuler ?"
• "Y a-t-il des postes à Alger ?"
• "Quels diplômes sont requis ?"
• "Quels sont les avantages ?"

Posez-moi votre question sur nos offres d'emploi !"""