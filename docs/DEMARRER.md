# Premier essai - DataPass Cloud Studio 0.1

Cette extension est independante de DataPass. Les guides et l'interface sont en anglais dans cette
premiere version. Aucun compte cloud n'est necessaire pour commencer.

1. Installe le fichier `datapass-vscode-cloud-0.1.0.vsix` depuis le menu Extensions > Install from VSIX.
2. Ouvre la palette de commandes et lance `Cloud Studio: Open Studio`.
3. Choisis Fabric, Power BI ou Azure, puis un parcours. La toolbox est aussi accessible a gauche.
4. Ouvre un dossier normal dans VS Code. S'il y a plusieurs dossiers, utilise `Choose working folder`.
5. Dans le parcours Azure Function, clique `Open source file` pour ouvrir un fichier a cote du guide.
   Ce bouton ouvre du texte source, pas un programme. Pour un notebook, utilise ensuite le choix natif
   `Reopen Editor With` de VS Code.
6. `Check CLI versions` demande quels programmes verifier. Seule leur version est recherchee,
   depuis ce poste. Aucun login, deploiement ou lancement de Function n'est effectue.
7. `Preview context for AI` ouvre un document de previsualisation. Verifie les metadonnees et noms
   de fichiers avant de confirmer la copie. Rien n'est envoye automatiquement a ChatGPT ou Claude.

`Open native tool` rend la main a une extension existante apres confirmation. Si elle n'est pas
visible sur cet hote ou n'expose pas de vue utilisable, Cloud Studio ouvre sa fiche native. Il ne
l'installe pas. Le bouton Documentation ouvre un navigateur apres accord.

Les cases de verification sont tes propres notes pour ce contexte, pas des tests executes. Elles
s'effacent lorsque le contexte est actualise. Les favoris et le choix Guide/Compact sont locaux.

## Test simple sans cloud

Ouvre `fixtures/sample` de ce depot. Tu dois voir `host.json` et `function_app.py` dans le parcours
Azure. Ce sont des fixtures de navigation, pas une Function executable. Le dossier doit rester
identique apres navigation et actualisation.

## Limites

La connexion aux comptes Microsoft, le modele Power BI et les vrais kernels Fabric ne sont pas
qualifies dans cette livraison. Databricks Studio et l'integration DataPass arriveront dans un lot
separe. Il n'y a pas de curseurs metier FOIL, de clone de compilateur ou de moteur de deploiement.
