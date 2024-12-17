curl -X  POST \
 'https://graph.facebook.com/v21.0/520286857826836/messages' \
 -H 'Authorization: Bearer EAAQPRuPIy6kBO9L2cDbAgrqxap7P41PEIn5sokU9BMIt2YjuKSwB8JRY8jw55UV16ViQCpSlnbTwL8etLCbLAtEYAU6ZAxMM6k7lOom0ujuNl4nupZCv5E3aLZBv1hwguJvEIm7ZAeUFXikXHA4UMTOLdJ5tqsvpzZApYEkQ2GIecrQZAdfR4p4t3lNU9YGN3xlQZDZD' \
 -H 'Content-Type: application/json' \
 -d '{
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "919175510124",
        "type": "interactive",
        "interactive":{
            "type": "list",
            "body": {
                "text": "Please choose the subject you want to practice"
            },
            "action": {
                "button": "Select a Subject",
                "sections":[
                    {
                    "title":"Subject",
                    "rows": [
                {
                    "id":"s1",
                    "title": "Mechanical Engineering"
                },
                {
                    "id":"s2",
                    "title": "Civil"
                },
                {
                    "id":"s3",
                    "title": "CSE"
                },
                {
                    "id":"s4",
                    "title": "Electrical"
                },
                {
                    "id":"s5",
                    "title": "Electronics"
                }
                ]
            }]
        }   
    }
  
}'

response:
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "540116915843067",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "919199396333",
              "phone_number_id": "520286857826836"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Pranav Salunkhe"
                },
                "wa_id": "919175510124"
              }
            ],
            "messages": [
              {
                "context": {
                  "from": "919199396333",
                  "id": "wamid.HBgMOTE5MTc1NTEwMTI0FQIAERgSQzAzMUJFRTlDN0I4QUFBRkNEAA=="
                },
                "from": "919175510124",
                "id": "wamid.HBgMOTE5MTc1NTEwMTI0FQIAEhgWM0VCMDY1RDdCRjZCODlERTFGQTE3MAA=",
                "timestamp": "1734379106",
                "type": "interactive",
                "interactive": {
                  "type": "list_reply",
                  "list_reply": {
                    "id": "s3",
                    "title": "CSE"
                  }
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}


curl -X  POST \
 'https://graph.facebook.com/v1/contacts' \
 -H 'Content-Type: application/json' \

 -d '{
  "blocking": "wait" | "no_wait",
  "contacts": [
  	"919175510124"
  ],
  "force_check": false | true
}'