# OrangeProxy

**SatsHack** (Hackaton from **SatsConf** 2023) project based on a proxy to help relay operators maintain a community that is spam free and aligned with their private policy of what is allowed to be posted (eg. can't that about shitcoins in this relay, etc.).

Leveraging [*nip42*][nip42] to prevent attackers and onboard users on the relay (without leaving the client) and LLMs to parse the privacy policy and to judge if the content adheres to the policy.

The idea was inspired by Michael Saylor's OrangeCheck [^orangecheck1] [^orangecheck2]

## Sub projects

- **proxy**: intercepts messages to ensure that only users that are authenticated ([NIP42][nip42]) with a committed collateral can stay connected on the relay, and helps the bot to onboard new users
- **bot**: onboard new users on the relay using DMs
- **llm**: parses the content policy (to be written by the relay operator) and judges if the content adheres to it or not. *L402 TBD*
- **dashboard**: *TBD* page where the relay operators can see what was reported and filter/ban users from the relay

## Using it

> The code was written in ~24h by sleep deprived developers. BE AWARE

Having your relay online (implementation agnostic), setup the proxy in front of it and setup your .env file with the required configs/secrets. Create a nostr key to be used as the onboarding bot. Host the llm and setup .env accordingly

*TBD*

 [nip42]: https://github.com/nostr-protocol/nips/blob/master/42.md
 [^orangecheck1]: https://twitter.com/saylor/status/1418590438781554689
 [^orangecheck2]: https://twitter.com/saylor/status/1508244604726001675