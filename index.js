const express = require('express')
const AWS = require('aws-sdk');
const { AnalyzeExpenseCommand } = require("@aws-sdk/client-textract");
const { TextractClient } = require("@aws-sdk/client-textract");
const cors = require('cors');



const multer = require('multer')

const REGION = 'us-east-1'
const accessKeyId = 'ASIAVPXTYGVCIYBDHCR2'
const secreteKey = '3Nyn7jUxorjLJWVSGVsKkD6NJLxKBDzJwgxGS0bi'
const sessionKey = 'IQoJb3JpZ2luX2VjEMv//////////wEaCXVzLXdlc3QtMiJGMEQCIBiq8o+aZrzgNQQCSrhBvTFaPP8RzXgfKPZPR4+49VhWAiAun3X9CCiA0jPbLy+FrhMwSErCWMjinwcxEkLty7m8SCq4Agj0//////////8BEAAaDDM3NzM5NDU3NDY2MCIM308vllpDFM4MOPshKowC+f0+MWFqxFhNkuHBYsMM4BD6rRGq5tA9Gd+1Astrkwtac17K5IW5ccqJKpQ95lNV1yrUuTey2oU3jjf+TYGI+m0hc7A7N72z4AahSVUDgvPxR50HebVxOpmyE3ginhIsCengdmF7/6whBa8L+t6sIyJkilss81cPcXOn+YMhVvEOARg5bh05OHqh1mXeMqO/xA+y3NFFM3UZFmcKaVO9rwWIg0OJ5NJLdM41q8E/I/xCncDjUxlNx2XDlmZ5vH2Jwa8s4v9HWhkAdn7yYtLVYQ+7xz8wxMJyQ4GqWufEzjZAbobxtnKeCFFY6XUZm5mMnIg3sMso/vA7DLkojms4cjtKTrCdhhJU8Q8a8TDmg9GwBjqeAfSN3eGEKQ/U8lkBTdealmTZ95Bi6lL8D8Qg7XMdaW7uD29VwLD6rYKHJf4Vx9YLYqFjkjQJ2TmRg2lTnqv/sCkWJCSm0anr4Q4SGExl9rj5Xlzpc5j2mUGBOsNCmIRQ67n4NfR230E0mmxnExwW/fWLKClV09oKjDHv80/upPWGIrIZwrfZOK91gnYUdJsLP6ynlgoJHgsbClGzYHZX'


const upload = multer({})
const app = express()

AWS.config.update({REGION, credentials: {accessKeyId: accessKeyId, secretAccessKey: secreteKey,sessionToken:sessionKey}})

app.use(cors())

app.get('/',(req,res)=>{
    res.send('okay')
})

app.get('/v2/buckets', (req, res)=>{
    const s3 = new AwsClient.AWS.S3({})
    s3.listBuckets((err, data)=>{
    if (err) console.log(err)
    res.send(data.Buckets)
    })
})


const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: REGION });
app.post('/v2/upload', upload.single('file'), async(req, res) => {
    const fileName = `${Date.now()}-${req.file.originalname}`
    try {
        const s3 = new AWS.S3({});
        let uploadParams = { 
            Key: fileName, 
            Bucket: 'textextractfromphoto', 
            Body: req.file.buffer 
        };
       
        s3.upload(uploadParams, (err, response) => {
            if (err) console.log(err);
           // res.send(fileName);
        });
        const randomNumber = Math.floor(Math.random() * 10000001);
        
        const textractClient = new TextractClient({
            region: REGION,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secreteKey,
                sessionToken: sessionKey
            }
        });
        const params = {
            Document: {
                Bytes: req.file.buffer
            },
        };  
            try {
                      
                const aExpense = new AnalyzeExpenseCommand(params);
                const response = await textractClient.send(aExpense);
        
                // Vérifier si ExpenseDocuments est défini et n'est pas vide
                if (response.ExpenseDocuments && response.ExpenseDocuments.length > 0) {
                    const expenseDoc = response.ExpenseDocuments[0];
        
                    // Vérifier si Blocks est défini et n'est pas vide
                    if (expenseDoc.Blocks && expenseDoc.Blocks.length > 0) {
                        // Créer un objet pour stocker les données extraites
                        const extractedData = {};
        
                        // Parcourir tous les blocs
                        for (const block of expenseDoc.Blocks) {
                            // Vérifier si le texte du bloc est défini
                            if (block.Text) {
                                // Stocker le texte du bloc
                                const text = block.Text;
        
                                // Extraire les informations en fonction du contenu du texte
                                if (text.includes("N. ")) {
                                    extractedData.numeroDuRecu = text.split("N. ")[1];
                                } else if (text.includes("B.P.F CFA")) {
                                    extractedData.total = text.split("B.P.F CFA")[1].trim();
                                } else if (text.includes("Reçu de M :")) {
                                    extractedData.nom = text.split("Reçu de M :")[1].trim();
                                } else if (text.includes("Dakar, le")) {
                                    extractedData.date = text.split("Dakar, le")[1].trim();
                                } else if (text.includes("De la classe de :")) {
                                    extractedData.classe = text.split("De la classe de :")[1].trim();
                                } else if (text.includes("Inscription :")) {
                                    extractedData.inscription = text.split("Inscription :")[1].trim();
                                } else if (text.includes("Scolarité :")) {
                                    extractedData.scolarite = text.split("Scolarité :")[1].trim();
                                }
                            }
                        }
        
                        // Stocker les données extraites dans DynamoDB
                        const params = {
                            TableName: 'receiptDB',
                            Item: {
                                DocumentKey:randomNumber,
                                numeroDuRecu:extractedData.numeroDuRecu,
                                nom: extractedData.nom,
                                classe:extractedData.classe,
                                total:extractedData.total,
                                date:extractedData.date,
                                inscription:extractedData.inscription,
                                scolarite:extractedData.scolarite
                                
                            }
                        };
        
                        dynamoDB.put(params, (err, data) => {
                            if (err) {
                                console.error("Erreur lors de la sauvegarde des données dans DynamoDB :", err);
                                res.status(500).send("Erreur lors de la sauvegarde des données dans DynamoDB");
                            } else {
                                res.json(extractedData);
                            }
                        });
                        
                    } else {
                        res.status(404).send("Aucune donnée dans Blocks");
                    }
                } else {
                    res.status(404).send("Aucun document d'expense trouvé");
                }
            } catch (error) {
                console.error("Erreur lors de l'analyse de l'expense :", error);
                res.status(500).send("Erreur lors de l'analyse de l'expense");
            }
        
        
    
    } catch (error) {
        res.send(error);
        console.log(error);
    }
});






app.get('/v2/list-documents', (req, res) => {
    const params = {
        TableName: 'receiptDB'
    };
    dynamoDB.scan(params, (err, data) => {
        if (err) {
            console.error("Erreur lors de la lecture des documents depuis DynamoDB :", err);
            res.status(500).send("Erreur lors de la lecture des documents depuis DynamoDB");
        } else {
            // Envoyer les documents récupérés en réponse
            res.json(data.Items);
        }
    });
});

                                      

app.listen(3000,()=>{console.log('server is running')})