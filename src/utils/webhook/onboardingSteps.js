function getOnboardingSteps(from, username){
    return [
        {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": `${from}`,
            "type": "template",
            "template":{
                "name": "welcome_msg",
                "language": {
                    "code": "en"
                },
                "components":[
                    {
                        "type": "body",
                        "parameters": [
                            {
                              "type": "text",
                              "parameter_name": "username",
                              "text": `${username}`,
                            },
                        ]
                    }
                ]
            },
        },
        {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": `${from}`,
            "type": "template",
            "template":{
                "name": "select_branch",
                "language": {
                  "code": "en"
                },
                "components": [
                  {
                    "type": "button",
                    "sub_type": "flow",
                    "index": "0",
                    "parameters": [
                      {
                        "type": "action",
                        "action": {}
                      }
                    ]
                  }
                ]
            },
        },
    ];
}

module.exports = {
    getOnboardingSteps,
}