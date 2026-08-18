# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-backup-feature.spec.js >> Backup feature works correctly
- Location: tests/e2e/test-backup-feature.spec.js:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.07.28.0" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - button "  Default" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Default
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - generic [ref=e13]:
      - link " Back to Dashboard" [ref=e14] [cursor=pointer]:
        - /url: /
        - generic [ref=e15]: 
        - text: Back to Dashboard
      - heading "Settings" [level=4] [ref=e16]
    - tablist [ref=e17]:
      - tab " Entity Types" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: 
        - text: Entity Types
      - tab "System Database" [ref=e20] [cursor=pointer]
      - tab "Contexts" [ref=e21] [cursor=pointer]
      - tab " Theme Editor" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: 
        - text: Theme Editor
    - generic [ref=e24]:
      - text:          
      - generic [ref=e25]:
        - generic [ref=e27]:
          - heading "Contexts" [level=4] [ref=e28]
          - paragraph [ref=e29]: Define top-level contexts (e.g. Work, Life, Hobbies) and configure each one's database, data sources, backup, and which tabs it shows.
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]:
              - heading "Contexts" [level=6] [ref=e33]
              - generic [ref=e34]:
                - button "+ Folder" [ref=e35] [cursor=pointer]
                - button "+ Context" [ref=e36] [cursor=pointer]
            - paragraph [ref=e37]: Click a context to configure it. Drag to reorder or drop into a folder.
            - generic [ref=e39]:
              - button "Change icon" [ref=e40] [cursor=pointer]:
                - generic [ref=e41]: 
              - generic [ref=e42]: Default
              - generic "Home database" [ref=e43]: 
              - generic "Owner" [ref=e44]: Aslynn's Stuff
              - button "Delete" [ref=e46] [cursor=pointer]:
                - generic [ref=e47]: 
          - generic [ref=e49]:
            - heading "Default" [level=5] [ref=e50]
            - generic [ref=e51]:
              - generic [ref=e52]:
                - generic [ref=e53]: User *
                - generic [ref=e54]:
                  - combobox [ref=e55]:
                    - option "Unassigned"
                    - option "Aslynn's Stuff" [selected]
                  - button "+ New User" [ref=e56] [cursor=pointer]
                - text: 
              - generic [ref=e57]:
                - generic [ref=e58]: External APIs
                - generic [ref=e59]:
                  - checkbox "Enable ServiceNow / Azure DevOps" [ref=e60]
                  - generic [ref=e61]: Enable ServiceNow / Azure DevOps
                - generic [ref=e62]: Allows fetching ticket details when dropping URLs
            - list [ref=e63]:
              - listitem [ref=e64]:
                - button "Tabs" [ref=e65] [cursor=pointer]
              - listitem [ref=e66]:
                - button "Database" [ref=e67] [cursor=pointer]
              - listitem [ref=e68]:
                - button "Schema" [ref=e69] [cursor=pointer]
              - listitem [ref=e70]:
                - button "External APIs" [ref=e71] [cursor=pointer]
              - listitem [ref=e72]:
                - button "Data Sources" [ref=e73] [cursor=pointer]
              - listitem [ref=e74]:
                - button "Backup & Restore" [ref=e75] [cursor=pointer]
            - generic [ref=e76]:
              - paragraph [ref=e77]: Each context has exactly one database connection (MySQL/MariaDB OR MSSQL). Switching to this context in the navbar activates its connection.
              - text:   
              - generic [ref=e78]:
                - generic [ref=e79]:
                  - generic [ref=e80]:
                    - heading "MySQL / MariaDB Connection" [level=6] [ref=e81]
                    - button "Remove" [ref=e82] [cursor=pointer]
                  - generic [ref=e84]:
                    - term [ref=e85]: Host
                    - definition [ref=e86]: 192.168.0.112
                    - term [ref=e87]: Port
                    - definition [ref=e88]: "3306"
                    - term [ref=e89]: Database
                    - definition [ref=e90]: MyWork
                    - term [ref=e91]: User
                    - definition [ref=e92]: MyWork
                    - term [ref=e93]: Password
                    - definition [ref=e94]: ••••••••
                - button "Update Settings" [ref=e95] [cursor=pointer]
                - button " Use System Database" [ref=e96] [cursor=pointer]:
                  - generic [ref=e97]: 
                  - text: Use System Database
                - generic [ref=e98]:
                  - heading "Backup" [level=6] [ref=e99]
                  - button " Create Backup" [ref=e100] [cursor=pointer]:
                    - generic [ref=e101]: 
                    - text: Create Backup
                  - generic [ref=e102]:
                    - generic [ref=e103]: 
                    - text: Error creating backup
              - text: 
            - text:            
        - text:                        
      - text:        
  - contentinfo [ref=e104]:
    - paragraph [ref=e106]: © 2026 MyWork. Licensed under the MIT License.
  - alert [ref=e108]:
    - text: "Error creating backup: Failed to fetch"
    - button "Close" [ref=e109] [cursor=pointer]
```