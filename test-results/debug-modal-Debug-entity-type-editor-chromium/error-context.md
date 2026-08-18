# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-modal.spec.js >> Debug entity type editor
- Location: tests/e2e/debug-modal.spec.js:3:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 9

- Array []
+ Array [
+   "Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "Error loading types: TypeError: Failed to fetch
+     at window.fetch (http://localhost:3000/js/forms.js:27:28)
+     at loadTypeRelationships (http://localhost:3000/js/entity-type-editor.js:214:28)
+     at showEntityTypeEditorModal (http://localhost:3000/js/entity-type-editor.js:118:3)
+     at openEntityTypeEditor (http://localhost:3000/js/entity-type-editor.js:26:5)
+     at HTMLButtonElement.<anonymous> (http://localhost:3000/js/settings-entity-types.js:54:7)",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]:
            - heading "Entity Types" [level=2] [ref=e29]
            - paragraph [ref=e30]: Create and manage entity types to organize your work.
          - button " New Type" [active] [ref=e31] [cursor=pointer]:
            - generic [ref=e32]: 
            - text: New Type
        - generic [ref=e33]:
          - heading "All Types" [level=5] [ref=e35]
          - generic [ref=e37]:
            - generic [ref=e38] [cursor=pointer]:
              - generic [ref=e39]:
                - generic [ref=e40]: ⭐
                - generic [ref=e41]:
                  - heading "Dailies" [level=6] [ref=e42]
                  - generic [ref=e43]: work_item
                  - generic [ref=e45]: 3 fields • Supports hierarchy
              - button " Edit" [ref=e47]:
                - generic [ref=e48]: 
                - text: Edit
            - generic [ref=e49] [cursor=pointer]:
              - generic [ref=e50]:
                - generic [ref=e51]: 📌
                - generic [ref=e52]:
                  - heading "Projects" [level=6] [ref=e53]
                  - generic [ref=e54]: priority
                  - generic [ref=e56]: 2 fields • Supports hierarchy
              - button " Edit" [ref=e58]:
                - generic [ref=e59]: 
                - text: Edit
            - generic [ref=e60] [cursor=pointer]:
              - generic [ref=e61]:
                - generic [ref=e62]: 📂
                - generic [ref=e63]:
                  - heading "Categories" [level=6] [ref=e64]
                  - generic [ref=e65]: area
                  - generic [ref=e67]: 1 fields • Supports hierarchy
              - button " Edit" [ref=e69]:
                - generic [ref=e70]: 
                - text: Edit
            - generic [ref=e71] [cursor=pointer]:
              - generic [ref=e72]:
                - generic [ref=e73]: 🎯
                - generic [ref=e74]:
                  - heading "Goals" [level=6] [ref=e75]
                  - generic [ref=e76]: goal
                  - generic [ref=e78]: 2 fields
              - button " Edit" [ref=e80]:
                - generic [ref=e81]: 
                - text: Edit
            - generic [ref=e82] [cursor=pointer]:
              - generic [ref=e83]:
                - generic [ref=e84]: ☑
                - generic [ref=e85]:
                  - heading "Todos" [level=6] [ref=e86]
                  - generic [ref=e87]: to_do
                  - generic [ref=e89]: 3 fields • Supports hierarchy
              - button " Edit" [ref=e91]:
                - generic [ref=e92]: 
                - text: Edit
            - generic [ref=e93] [cursor=pointer]:
              - generic [ref=e94]:
                - generic [ref=e95]: 📋
                - generic [ref=e96]:
                  - heading "Tasks" [level=6] [ref=e97]
                  - generic [ref=e98]: task
                  - generic [ref=e100]: 3 fields • Supports hierarchy
              - button " Edit" [ref=e102]:
                - generic [ref=e103]: 
                - text: Edit
            - generic [ref=e104] [cursor=pointer]:
              - generic [ref=e105]:
                - generic [ref=e106]: 🎫
                - generic [ref=e107]:
                  - heading "Tickets" [level=6] [ref=e108]
                  - generic [ref=e109]: ticket
                  - generic [ref=e111]: 2 fields • Supports hierarchy
              - button " Edit" [ref=e113]:
                - generic [ref=e114]: 
                - text: Edit
            - generic [ref=e115] [cursor=pointer]:
              - generic [ref=e116]:
                - generic [ref=e117]: 💡
                - generic [ref=e118]:
                  - heading "Brainstorming" [level=6] [ref=e119]
                  - generic [ref=e120]: idea
                  - generic [ref=e122]: 2 fields • Supports hierarchy
              - button " Edit" [ref=e124]:
                - generic [ref=e125]: 
                - text: Edit
            - generic [ref=e126] [cursor=pointer]:
              - generic [ref=e127]:
                - generic [ref=e128]: 📑
                - generic [ref=e129]:
                  - heading "Templates" [level=6] [ref=e130]
                  - generic [ref=e131]: template
                  - generic [ref=e133]: 1 fields
              - button " Edit" [ref=e135]:
                - generic [ref=e136]: 
                - text: Edit
      - text:                                                      
  - contentinfo [ref=e137]:
    - paragraph [ref=e139]: © 2026 MyWork. Licensed under the MIT License.
  - generic [ref=e141]:
    - generic [ref=e142]:
      - heading "Create New Entity Type" [level=3] [ref=e143]
      - generic [ref=e144]:
        - button "" [ref=e145] [cursor=pointer]
        - button "" [ref=e147] [cursor=pointer]
    - generic [ref=e151]:
      - generic [ref=e152]:
        - generic [ref=e153]:
          - generic [ref=e154]: Name *
          - textbox "e.g., Project, Task" [ref=e155]
        - generic [ref=e156]:
          - generic [ref=e157]: Singular Form *
          - textbox "e.g., Project, Task" [ref=e158]
      - generic [ref=e159]:
        - generic [ref=e160]:
          - generic [ref=e161]: Icon (Emoji)
          - textbox "😊" [ref=e162]
        - generic [ref=e163]:
          - generic [ref=e164]: Supports Hierarchy
          - generic [ref=e165]:
            - checkbox "Items can have parents/children of the same type" [ref=e166]
            - generic [ref=e167]: Items can have parents/children of the same type
      - generic [ref=e169]:
        - heading "Fields" [level=6] [ref=e170]
        - button "+ Add Field" [ref=e171] [cursor=pointer]
      - generic [ref=e173]:
        - heading "Type Relationships" [level=6] [ref=e174]
        - generic [ref=e175]:
          - generic [ref=e176]: "Can have parents:"
          - generic [ref=e179]: "Can have children:"
    - generic [ref=e183]:
      - button "Cancel" [ref=e184] [cursor=pointer]
      - button "Save" [ref=e185] [cursor=pointer]
```