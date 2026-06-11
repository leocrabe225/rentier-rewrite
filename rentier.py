from tkinter import *
from random import *
from threading import *
from math import *
import time
import os
os.chdir("Images")
fenetre = Tk()
fenetre.title("Monopoly")
fenetre.configure(height=700, width=700,bg="white")
canvas= Canvas(fenetre)
canvas.configure(height=700, width=700,bg="white")
canvas.place(x=0,y=0)
plateauDeJeu = PhotoImage(file="plateau_de_jeu_test4_et_final.png")
AffichagePlateauDeJeu = canvas.create_image(350,350,image=plateauDeJeu)
positionGare = [4,13,23,31]
tourActif = 0
positionJoueurs = [1]*4
vieJoueurs = [1]*4
joueurActuel = 0
choixNiveauOn = 0
argentJoueurs = [15000]*4
possessionJoueurs = [[],[],[],[]]
traitementCases = [
[   4,   0,   0,   2,   3,   0,   1,   0,   0,   4,   0,   0,   0,   3,   0,   1,   0,   0,   4,   0,   1,   0,   0,   3,   0,   0,   0,   4,   0,   0,   0,   3,   1,   0,   2,   0], #type de case
[   0, 600, 600,2000,2000,1000,   0,1000,1200,   0,1400,1400,1600,2000,1800,   0,1800,2000,   0,2200,   0,2200,2400,2000,2600,2600,2800,   0,3000,3000,3200,2000,   0,3500,1000,4000], #prix des case
[   0, 150, 150,   0,   0, 250,   0, 250, 300,   0, 350, 350, 400,   0, 450,   0, 450, 500,   0, 550,   0, 550, 600,   0, 650, 650, 700,   0, 750, 750, 800,   0,   0, 900,   0,1000], #loyer lv1
[   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0], #possession
[   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0], #Lv case
[   0,   1,   1,   0,   0,   2,   0,   2,   2,   0,   3,   3,   3,   0,   4,   0,   4,   4,   0,   5,   0,   5,   5,   0,   6,   6,   6,   0,   7,   7,   7,   0,   0,   8,   0,   8], #monopole
["","M.Ferreira","M.Abbas","","","A.Claquin","","K.Burel","K.Rigal","","D.Raunier","A.Guyonnet","M.Berlu","","A.Mallet","","Q.Roger","L.Bouhnik","","Y.Harchaoui","","A.Amine","L.Dongois","","C.Carpentier","R.Humbert","M.Benidger","","W.Omdara","M.Defachelle","Z.ElKhabli","","","J.Damoiseau","","L.Calendini"]]

couleurJoueur = ["red","dodgerblue","green","orange"]
tempsPrison = [0]*4
doubleDeSuite = 0
vientDeDoubler = 0
listeCarte = [0,1,2,3,4,5,6]
correspondanceCarte = [500,1000,2000,500,1000,2000,200400]
shuffle(listeCarte)

def animationDes():
    global de1
    global de2
    for loop in range(50):
        de1 = randint(1,6)
        de2 = randint(1,6)
        time.sleep(loop/1000)
        canvas.itemconfig(AffichageDes1, image=imageDes[de1-1])
        canvas.itemconfig(AffichageDes2, image=imageDes[de2-1])
        fenetre.update()

def lancerDes():
    global joueurActuel
    global tourActif
    global doubleDeSuite
    global vientDeDoubler
    global de1
    global de2
    global prixLoyerGare
    global prixApayer
    global monopole
    global montant
    vientDeDoubler == 0
    boutonLancerDes.place_forget()
    boutonAmeliorer.place_forget()
    if tourActif == 0 and tempsPrison[joueurActuel]==0:
        boutonAmeliorer.place_forget()
        tourActif = 1
        animationDes()
        if de1==de2:
            doubleDeSuite = doubleDeSuite + 1
            vientDeDoubler = 1
        if doubleDeSuite < 3:
            totalDes = de1 +de2
            for loop in range(totalDes):
                x=0
                y=0
                if 1<=positionJoueurs[joueurActuel]<=9:
                    x=-1
                elif 10<=positionJoueurs[joueurActuel]<=18:
                    y=-1
                elif 19<=positionJoueurs[joueurActuel]<=27:
                    x=1
                else:
                    y=1
                for loop in range(51):
                    canvas.move(AffichageJoueurListe[joueurActuel],x,y)
                    time.sleep(0.001)
                    fenetre.update()
                positionJoueurs[joueurActuel] = positionJoueurs[joueurActuel] + 1
                if positionJoueurs[joueurActuel] == 37:
                    positionJoueurs[joueurActuel] = 1
                    argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]+2000
                    refreshArgent()
                    fenetre.update()
            if traitementCases[0][positionJoueurs[joueurActuel]-1] == 0:
                boutonAmeliorer.place_forget()
                if traitementCases[3][positionJoueurs[joueurActuel]-1] == 0:
                    textePrixAchatPropriete.config(text="Prix de la propriété : "+str(traitementCases[1][positionJoueurs[joueurActuel]-1]))
                    textePrixAchatPropriete.place(x=300,y=395)
                    boutonAcheterPropriete.place(x=250,y=365)
                    boutonRefuserPropriete.place(x=400,y=365)
                elif traitementCases[3][positionJoueurs[joueurActuel]-1] != joueurActuel+1:
                    monopole = 1
                    numeroMonopole = traitementCases[5][positionJoueurs[joueurActuel]-1]
                    proprietaire = traitementCases[3][positionJoueurs[joueurActuel]-1]
                    for loop in range(36):
                        if traitementCases[5][loop] == numeroMonopole and traitementCases[3][loop] != proprietaire:
                            monopole = 0
                    montant = (traitementCases[2][positionJoueurs[joueurActuel]-1])*(traitementCases[4][positionJoueurs[joueurActuel]-1])
                    if monopole == 1:
                        montant = montant * 2
                    textePrixLoyer.config(text="Montant à régler : "+str(montant))
                    textePrixLoyer.place(x=300,y=395)
                    boutonPayerLoyer.place(x=250,y=365)
                else:
                    tourSuivant()
            elif traitementCases[0][positionJoueurs[joueurActuel]-1] == 2:
                boutonAmeliorer.place_forget()
                textePrixLoyer.config(text="Montant à régler : "+str(traitementCases[1][positionJoueurs[joueurActuel]-1]))
                textePrixLoyer.place(x=300,y=395)
                boutonPayerTaxe.place(x=250,y=365)
            elif positionJoueurs[joueurActuel] == 28:
                boutonAmeliorer.place_forget()
                tempsPrison[joueurActuel] = 3
                vientDeDoubler = 0
                for loop in range(459):
                    canvas.move(AffichageJoueurListe[joueurActuel],-1,1)
                    time.sleep(0.001)
                    fenetre.update()
                positionJoueurs[joueurActuel] = 10
                tourSuivant()
            elif positionJoueurs[joueurActuel] == 19:
                for loop in range(4):
                    if loop!=joueurActuel and tempsPrison[loop] == 0 and vieJoueurs[loop]==1:
                        boutonAmeliorer.place_forget()
                        placeJoueur = canvas.coords(AffichageJoueurListe[loop])
                        bonusX = 0
                        bonusY = 0
                        if loop == 0 or loop == 1:
                            bonusY = 25
                        if loop == 1 or loop == 3:
                            bonusX = -25
                        for leep in range(int(placeJoueur[0])-108+bonusX):
                            canvas.move(AffichageJoueurListe[loop],-1,0)
                            time.sleep(0.001)
                            fenetre.update()
                        for leep in range(int(placeJoueur[1]-133+bonusY)):
                            canvas.move(AffichageJoueurListe[loop],0,-1)
                            time.sleep(0.001)
                            fenetre.update()
                        positionJoueurs[loop] = 19
                tourSuivant()
            elif traitementCases[0][positionJoueurs[joueurActuel]-1] == 3:
                boutonAmeliorer.place_forget()
                if traitementCases[3][positionJoueurs[joueurActuel]-1] == 0:
                    textePrixAchatPropriete.config(text="Prix de la propriété : "+str(traitementCases[1][positionJoueurs[joueurActuel]-1]))
                    textePrixAchatPropriete.place(x=300,y=395)
                    boutonAcheterPropriete.place(x=250,y=365)
                    boutonRefuserPropriete.place(x=400,y=365)
                elif traitementCases[3][positionJoueurs[joueurActuel]-1] != joueurActuel+1:
                    possesseurGare = traitementCases[3][positionJoueurs[joueurActuel]-1]
                    prixLoyerGare = 250
                    for loop in range(4):
                        if traitementCases[3][positionGare[loop]]==possesseurGare and positionJoueurs[joueurActuel]-1!=positionGare[loop]:
                            prixLoyerGare = prixLoyerGare * 2
                    textePrixLoyer.config(text="Montant à régler : "+str(prixLoyerGare))
                    textePrixLoyer.place(x=300,y=395)
                    boutonPayerGare.place(x=250,y=365)
                else:
                    tourSuivant()
            elif traitementCases[0][positionJoueurs[joueurActuel]-1] == 1:
                boutonAmeliorer.place_forget()
                canvas.create_rectangle(250,250,450,330,fill="white",tag = "carte")
                if 0<=listeCarte[6]<=2:
                    texteEffetCarte.place(x=300,y=280)
                    texteEffetCarte.configure(text="Vous gagnez "+str(correspondanceCarte[listeCarte[6]]))
                    fenetre.update()
                    time.sleep(2)
                    argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel] + correspondanceCarte[listeCarte[6]]
                    canvas.delete("carte")
                    texteEffetCarte.place_forget()
                    tourSuivant()
                elif 3<=listeCarte[6]<=5:
                    prixApayer = correspondanceCarte[listeCarte[6]]
                    texteEffetCarte.place(x=300,y=280)
                    texteEffetCarte.configure(text="Vous perdez "+str(prixApayer))
                    boutonPayerCarte.place(x=300,y=400)
                else:
                    texteEffetCarte.place(x=270,y=270)
                    texteEffetCarte.configure(text="Vous perdez 400 par propriété\n et 200 par amélioration")
                    fenetre.update()
                    prixApayer = len(possessionJoueurs[joueurActuel])*400
                    for loop in range(len(possessionJoueurs[joueurActuel])):
                        prixApayer = prixApayer + traitementCases[4][possessionJoueurs[joueurActuel][loop]]*200
                    boutonPayerCarte.place(x=300,y=400)
                carte = listeCarte[6]
                del listeCarte[6]
                listeCarte.insert(0,carte)
            else:
                tourSuivant()
        else:
            boutonAmeliorer.place_forget()
            tempsPrison[joueurActuel] = 3
            placeJoueur = canvas.coords(AffichageJoueurListe[joueurActuel])
            bonusX = 0
            bonusY = 0
            if joueurActuel == 0 or joueurActuel == 1:
                bonusY = -25
            if joueurActuel == 1 or joueurActuel == 3:
                bonusX = -25
            for loop in range(int(placeJoueur[0])-108+bonusX):
                canvas.move(AffichageJoueurListe[joueurActuel],-1,0)
                time.sleep(0.001)
                fenetre.update()
            for loop in range(int(592-placeJoueur[1]+bonusY)):
                canvas.move(AffichageJoueurListe[joueurActuel],0,1)
                time.sleep(0.001)
                fenetre.update()
            vientDeDoubler = 0
            positionJoueurs[joueurActuel] = 10
            tourSuivant()

    elif tempsPrison[joueurActuel]!=0:
        boutonSoudoyerPrison.place_forget()
        animationDes()
        if de1 == de2:
            tempsPrison[joueurActuel]=0
            boutonLancerDes.place(x=250,y=365)
        else:
            tempsPrison[joueurActuel]=tempsPrison[joueurActuel]-1
            tourSuivant()



def tourSuivant():
    global joueurActuel
    global tourActif
    global vientDeDoubler
    global doubleDeSuite
    if vientDeDoubler == 0 or vieJoueurs[joueurActuel]==0:
        joueurActuel = joueurActuel + 1
        if joueurActuel == 4:
            joueurActuel = 0
        while vieJoueurs[joueurActuel]==0:
            joueurActuel = joueurActuel + 1
            if joueurActuel==4:
                joueurActuel=0
        doubleDeSuite = 0
        texteNumeroJoueurActif.config(text="Tour du joueur "+str(joueurActuel+1))
    tourActif = 0
    vientDeDoubler = 0
    boutonLancerDes.place(x=250,y=365)
    if len(possessionJoueurs[joueurActuel]) != 0:
        boutonAmeliorer.place(x=350,y=365)
    else:
        boutonAmeliorer.place_forget()
    if tempsPrison[joueurActuel]!=0:
        boutonSoudoyerPrison.place(x=230,y=400)
    refreshArgent()

def couleurProprietaire(numeroRectangle,positionCase):
    global joueurActuel
    x = 555
    y = 555
    xAjout = 1
    yAjout = 50
    xAjout2 = 8
    yAjout2 = 11
    xNumero = 10
    yNumero = 0
    for loop in range(positionCase):
        if 1<=loop+1<=9:
            x = x-51
        if 10<=loop+1<=18:
            y = y-51
            yAjout = 1
            xAjout = -1
            xAjout2 = -11
            yAjout2 = 8
            xNumero = 0
            yNumero = 10
        if 19<=loop+1<=27:
            x = x +51
            xAjout = 48
            yAjout = -1
            xAjout2 = -8
            yAjout2 = -11
            yNumero = 0
            xNumero = -10
        if 28<=loop+1<=36:
            y = y+51
            yAjout = 48
            xAjout = 50
            xAjout2 = 11
            yAjout2 = -8
            xNumero = 0
            yNumero = -10
    x = x+xAjout
    y = y+yAjout
    rectangle = canvas.create_rectangle(x+xNumero*numeroRectangle,y+yNumero*numeroRectangle,x+xAjout2+xNumero*numeroRectangle,y+yAjout2+yNumero*numeroRectangle,fill=couleurJoueur[joueurActuel],outline=couleurJoueur[joueurActuel],width=1)




def acheterPropriete():
    global joueurActuel
    if argentJoueurs[joueurActuel]>=traitementCases[1][positionJoueurs[joueurActuel]-1]:
        argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]-traitementCases[1][positionJoueurs[joueurActuel]-1]
        traitementCases[3][positionJoueurs[joueurActuel]-1] = joueurActuel+1
        if len(possessionJoueurs[joueurActuel])!=0 and traitementCases[0][positionJoueurs[joueurActuel]-1] != 3:
            indentation = 0
            while len(possessionJoueurs[joueurActuel])>indentation and possessionJoueurs[joueurActuel][indentation] < positionJoueurs[joueurActuel]:
                indentation += 1
            possessionJoueurs[joueurActuel].insert(indentation,positionJoueurs[joueurActuel])
        elif traitementCases[0][positionJoueurs[joueurActuel]-1] != 3:
            possessionJoueurs[joueurActuel].append(positionJoueurs[joueurActuel])
        boutonAcheterPropriete.place_forget()
        textePrixAchatPropriete.place_forget()
        boutonRefuserPropriete.place_forget()
        if traitementCases[0][positionJoueurs[joueurActuel]-1] != 3:
            couleurProprietaire(0,positionJoueurs[joueurActuel]-1)
        tourSuivant()

def refuserPropriete():
    boutonAcheterPropriete.place_forget()
    textePrixAchatPropriete.place_forget()
    boutonRefuserPropriete.place_forget()
    tourSuivant()

def payerLoyer():
    global joueurActuel
    global montant
    boutonPayerLoyer.place_forget()
    if argentJoueurs[joueurActuel]>=montant:
        argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]-montant
        argentJoueurs[(traitementCases[3][positionJoueurs[joueurActuel]-1])-1] = argentJoueurs[(traitementCases[3][positionJoueurs[joueurActuel]-1])-1] + montant
        textePrixLoyer.place_forget()
        tourSuivant()
    else:
        faillite()

def payerTaxe():
    global joueurActuel
    global montant
    montant = traitementCases[1][positionJoueurs[joueurActuel]-1]
    boutonPayerTaxe.place_forget()
    if argentJoueurs[joueurActuel]>=montant:
        argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]-traitementCases[1][positionJoueurs[joueurActuel]-1]
        textePrixLoyer.place_forget()
        tourSuivant()
    else:
        faillite()

def payerGare():
    global joueurActuel
    global prixLoyerGare
    global montant
    montant = prixLoyerGare
    boutonPayerGare.place_forget()
    if argentJoueurs[joueurActuel]>=prixLoyerGare:
        argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]-prixLoyerGare
        argentJoueurs[(traitementCases[3][positionJoueurs[joueurActuel]-1])-1] = argentJoueurs[(traitementCases[3][positionJoueurs[joueurActuel]-1])-1] + prixLoyerGare
        textePrixLoyer.place_forget()
        tourSuivant()
    else:
        faillite()

def soudoyerPrison():
    global joueurActuel
    if argentJoueurs[joueurActuel]>=500:
        argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]-500
        boutonSoudoyerPrison.place_forget()
        tempsPrison[joueurActuel] = 0

def ameliorer():
    global joueurActuel
    global choixProprieteAmeliorer
    global retourAmeliorerOn
    if len(possessionJoueurs[joueurActuel]) != 0:
        choixProprieteAmeliorer =  Listbox(fenetre,height=len(possessionJoueurs[joueurActuel]),width=20,selectmode="single")
        choixProprieteAmeliorer.place(x=350,y=400)
        for loop in range(len(possessionJoueurs[joueurActuel])):
            choixProprieteAmeliorer.insert(loop+1,traitementCases[6][possessionJoueurs[joueurActuel][loop]-1]+"   lvl : "+str(traitementCases[4][possessionJoueurs[joueurActuel][loop]-1]))
    boutonAmeliorer.place_forget()
    boutonLancerDes.place_forget()
    boutonRetourAmeliorer.place(x=350,y=365)
    retourAmeliorerOn = 0
    timer = Timer(0.01,choixAmeliorerFait)
    timer.start()

def choixAmeliorerFait():
    global choixProprieteAmeliorer
    global joueurActuel
    global choixNiveauOn
    global choixNiveauAmeliorer
    global retourAmeliorerOn
    global niveauProprieteActuelle
    global numeroProprieteAmeliorer
    if retourAmeliorerOn == 0:
        rangChoixAmeliorer = choixProprieteAmeliorer.curselection()
        if len(rangChoixAmeliorer) != 0:
            numeroProprieteAmeliorer = rangChoixAmeliorer[0]
            niveauProprieteActuelle = traitementCases[4][possessionJoueurs[joueurActuel][rangChoixAmeliorer[0]]-1]
            if choixNiveauOn ==1:
                choixNiveauAmeliorer.place_forget()
                del choixNiveauAmeliorer
            choixNiveauAmeliorer =  Listbox(fenetre,height=4,width=10,selectmode="single")
            choixNiveauAmeliorer.place(x=450,y=400)
            if choixNiveauOn == 0:
                timer2 = Timer(0.01,choixNiveauFait)
                timer2.start()
            choixNiveauOn = 1
            for loop in range(4):
                if loop >= niveauProprieteActuelle:
                    choixNiveauAmeliorer.insert(loop+1,"lvl : "+str(loop+1)+"   "+str(500*(((possessionJoueurs[joueurActuel][rangChoixAmeliorer[0]]-1)//9)+1)*(loop-niveauProprieteActuelle+1)))
                else:
                    choixNiveauAmeliorer.insert(loop+1,"lvl : "+str(loop+1)+"   Fait")
            choixProprieteAmeliorer.selection_clear(0, END)
    if retourAmeliorerOn == 0:
        timer = Timer(0.01,choixAmeliorerFait)
        timer.start()

def choixNiveauFait():
    global choixProprieteAmeliorer
    global choixNiveauAmeliorer
    global niveauProprieteActuelle
    global numeroProprieteAmeliorer
    global joueurActuel
    global choixNiveauOn
    global retourAmeliorerOn
    if retourAmeliorerOn == 0:
        rangChoixNiveau = choixNiveauAmeliorer.curselection()
        if len(rangChoixNiveau) != 0:
            if niveauProprieteActuelle < rangChoixNiveau[0]+1:
                prixAmeliorer = 500*(((possessionJoueurs[joueurActuel][numeroProprieteAmeliorer]-1)//9)+1)*(rangChoixNiveau[0]-niveauProprieteActuelle+1)
                nouveauNiveau = rangChoixNiveau[0]+1
                if argentJoueurs[joueurActuel]>=prixAmeliorer:
                    argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel] - prixAmeliorer
                    for loop in range(traitementCases[4][possessionJoueurs[joueurActuel][numeroProprieteAmeliorer]-1],nouveauNiveau):
                        couleurProprietaire(loop+1,possessionJoueurs[joueurActuel][numeroProprieteAmeliorer]-1)
                    traitementCases[4][possessionJoueurs[joueurActuel][numeroProprieteAmeliorer]-1] = nouveauNiveau
                    choixNiveauAmeliorer.place_forget()
                    del choixNiveauAmeliorer
                    choixNiveauOn = 0
                    choixProprieteAmeliorer.delete(numeroProprieteAmeliorer)
                    choixProprieteAmeliorer.insert(numeroProprieteAmeliorer,traitementCases[6][possessionJoueurs[joueurActuel][numeroProprieteAmeliorer]-1]+"   lvl : "+str(nouveauNiveau))
                    refreshArgent()
            else:
                choixNiveauAmeliorer.selection_clear(0, END)
                timer2 = Timer(0.01,choixNiveauFait)
                timer2.start()
        else:
            timer2 = Timer(0.01,choixNiveauFait)
            timer2.start()

def retourAmeliorer():
    global choixProprieteAmeliorer
    global choixNiveauOn
    global retourAmeliorerOn
    global choixNiveauAmeliorer
    retourAmeliorerOn = 1
    choixProprieteAmeliorer.place_forget()
    del choixProprieteAmeliorer
    if choixNiveauOn == 1:
        choixNiveauAmeliorer.place_forget()
        del choixNiveauAmeliorer
        choixNiveauOn = 0
    boutonRetourAmeliorer.place_forget()
    boutonAmeliorer.place(x=350,y=365)
    boutonLancerDes.place(x=250,y=365)

def refreshArgent():
    for loop in range(4):
        listeTexteArgent[loop].configure(text = "joueur "+str(loop+1)+" : "+str(argentJoueurs[loop]))

def faillite():
    global montant
    boutonFaillite.place(x=230,y=365)

def faireFaillite():
    global joueurActuel
    for loop in range(len(possessionJoueurs[joueurActuel])):
        traitementCases[3][possessionJoueurs[joueurActuel][loop]] = 0
        traitementCases[4][possessionJoueurs[joueurActuel][loop]] = 0
    possessionJoueurs[joueurActuel]=[]
    vieJoueurs[joueurActuel] = 0
    canvas.delete(AffichageJoueurListe[joueurActuel])
    listeTexteArgent[joueurActuel].place_forget()
    if sum(vieJoueurs)!=1:
        boutonFaillite.place_forget()
        textePrixLoyer.place_forget()
        tourSuivant()

def payerCarte():
    global joueurActuel
    global prixApayer
    boutonPayerCarte.place_forget()
    if argentJoueurs[joueurActuel]>=prixApayer:
        argentJoueurs[joueurActuel] = argentJoueurs[joueurActuel]-prixApayer
        texteEffetCarte.place_forget()
        canvas.delete("carte")
        tourSuivant()
    else:
        faillite()

imageDes = [PhotoImage(file="de1.gif"),PhotoImage(file="de2.gif"),PhotoImage(file="de3.gif"),PhotoImage(file="de4.gif"),PhotoImage(file="de5.gif"),PhotoImage(file="de6.gif")]
AffichageDes1=canvas.create_image(200,200,image=imageDes[0])
AffichageDes2=canvas.create_image(500,200,image=imageDes[0])
joueur1 = PhotoImage(file="Joueur 1.png")
joueur2 = PhotoImage(file="Joueur 2.png")
joueur3 = PhotoImage(file="Joueur 3.png")
joueur4 = PhotoImage(file="Joueur 4.gif")
listeTexteArgent = [Label(text="joueur 1 : 15000",bg="grey"),Label(text="joueur 2 : 15000",bg="grey"),Label(text="joueur 3 : 15000",bg="grey"),Label(text="joueur 4 : 15000",bg="grey")]
listeTexteArgent[0].place(x=150,y=150)
listeTexteArgent[1].place(x=450,y=150)
listeTexteArgent[2].place(x=150,y=520)
listeTexteArgent[3].place(x=450,y=520)
AffichageJoueurListe = [canvas.create_image(567,567,image=joueur1),canvas.create_image(592,567,image=joueur2),canvas.create_image(567,592,image=joueur3),canvas.create_image(592,592,image=joueur4)]
texteNumeroJoueurActif = Label(text="Tour du joueur 1",bg="grey")
texteNumeroJoueurActif.place(x=300,y=345)
textePrixAchatPropriete = Label(text="",bg="grey")
textePrixLoyer = Label(text="",bg="grey")
texteEffetCarte = Label(text="",bg="white")
boutonLancerDes = Button(text="Lancer les dés",command=lancerDes)
boutonLancerDes.place(x=250,y=365)
boutonAcheterPropriete = Button(text="Acheter cette propriété",command=acheterPropriete)
boutonRefuserPropriete = Button(text="Refuser",command=refuserPropriete)
boutonPayerLoyer = Button(text="Payer le loyer",command=payerLoyer)
boutonPayerGare = Button(text="Payer le loyer",command=payerGare)
boutonAmeliorer = Button(text="Améliorer vos propriétés",command=ameliorer)
boutonRetourAmeliorer = Button(text="Retour",command=retourAmeliorer)
boutonPayerTaxe = Button(text="Payer la taxe",command=payerTaxe)
boutonSoudoyerPrison = Button(text="Soudoyer le garde",command=soudoyerPrison)
boutonPayerCarte = Button(text="Payer la carte",command = payerCarte)
boutonFaillite = Button(text="Faire faillite",command=faireFaillite)
fenetre.mainloop()