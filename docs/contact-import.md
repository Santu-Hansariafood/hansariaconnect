# Device contact import

The Contacts page uses the browser Contact Picker API to let a signed-in user
choose device contacts. Only the selected contact names and phone numbers are
sent to HansariaConnect. The authenticated batch endpoint normalizes Indian
mobile numbers and saves them in the existing `Contact` MongoDB collection,
owned by the signed-in user. Re-imports skip numbers already in that user's
address book.

## Browser and Android setup

1. Configure the app's existing MongoDB connection (`MONGODB_URI`) and deploy
   the application over HTTPS. `localhost` is also treated as a secure context
   for local development.
2. Keep the Contacts page available at `/contacts` and signed-in users routed
   there. The current web manifest already includes this route and a `/` scope.
3. Use a current Chrome-based Android browser/TWA that supports the Contact
   Picker API. Open **Contacts → Use mobile contacts** and select entries in
   the Android system picker. Test on a real Android device; desktop browsers
   generally do not implement this API.
4. For a Trusted Web Activity, serve the web app from the same HTTPS origin
   configured for the TWA and maintain the normal Digital Asset Links
   association (`/.well-known/assetlinks.json`) for the app package and signing
   certificate. The picker is a browser web API, not an Android native bridge.
5. No Android `READ_CONTACTS` manifest permission or separate website
   permission prompt is needed. The system picker grants access only to the
   contacts and fields the user selects. The feature requests only `name` and
   `tel`; contact data is posted only after selection and is protected by the
   app's signed-in session.
6. On browsers or TWA versions without `navigator.contacts.select`, use the
   existing Google Contacts import or add contacts manually. Do not silently
   fall back to reading the entire address book.

A plain Android WebView wrapper is not necessarily a TWA and may not expose
the Contact Picker API. Adding `READ_CONTACTS` to its manifest alone will not
make `navigator.contacts.select` available; that wrapper would need a separate,
explicitly permissioned native bridge.

## API behavior

`POST /api/contacts/import` accepts an authenticated JSON body containing up
to 500 selected contacts, with up to 10 phone numbers per contact. It returns
the number added and the numbers skipped because they were already saved or
were not valid Indian mobile numbers. It does not expose the selected contact
data in its response.

For a quick end-to-end check, sign in on an HTTPS Android build, open
`/contacts`, choose a test contact that has a valid Indian mobile number, and
confirm that it appears in the contacts list. Import the same selection again
to confirm it is reported as already saved rather than duplicated.
