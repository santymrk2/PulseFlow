<script>
    import { slide } from "svelte/transition"
    import { activePopup, guideActive, isDev, special } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import Link from "../inputs/Link.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"

    const ONE_DAY = 1000 * 60 * 60 * 24

    const messages = {
        donate: "FreeShow is free because of the generous gifts of our users. Would you consider donating to FreeShow? With your help we can continue to meet the tech needs of the Church."
        // welcome: "Welcome to FreeShow! We're glad to have you here. Explore the features and let us know if you need any help getting started.",
        // update: "FreeShow has been updated to the latest version! Check out the new features and improvements we've made for a better experience."
    }

    let activeMessage = "donate"
    let message = messages[activeMessage]
    let key = `tipbar_${activeMessage}`

    let lastClosed = $special[`${key}_closed`] || 0
    let lastInteracted = $special[`${key}_interacted`] || 0
    let now = Date.now()
    // don't show again until after 7 days if closed, or 14 days if interacted
    let recentlyInteracted = lastInteracted ? now - lastInteracted < ONE_DAY * 14 : now - lastClosed < ONE_DAY * 7
    // show if: not recently interacted & 30% chance & month is december & year is 2026 (for now)
    let isClosed = recentlyInteracted || Math.random() > 0.3 || new Date().getMonth() !== 11 || new Date().getFullYear() !== 2026

    function close() {
        isClosed = true

        special.update((a) => {
            a[`${key}_closed`] = Date.now()
            return a
        })
    }

    function interact() {
        isClosed = true

        special.update((a) => {
            a[`${key}_interacted`] = Date.now()
            return a
        })
    }

    function donate() {
        sendMain(Main.URL, "https://churchapps.org/partner#give")
        interact()
    }

    $: if ($activePopup === "initialize" || $guideActive) isClosed = true
</script>

{#if !isClosed && !$isDev}
    <section class="toolbar" transition:slide={{ duration: 150 }}>
        <div class="text">
            {#if activeMessage === "donate"}
                <Icon id="heart" right size={0.8} white />
            {/if}

            {message}

            {#if activeMessage === "donate"}
                <MaterialButton variant="outlined" style="margin-left: 10px;padding: 2px 10px;" on:click={donate}>
                    <span style="font-weight: 600;">Donate</span>
                    <Icon id="launch" white />
                </MaterialButton>
            {/if}
        </div>

        <div class="close">
            <MaterialButton style="padding: 6px;" title="actions.close" icon="close" on:click={close} />
        </div>
    </section>
{/if}

<style>
    section {
        width: 100%;
        background-color: var(--bg);

        display: flex;
        align-items: center;
        justify-content: space-between;

        padding: 4px 12px;

        border-bottom: 1px solid var(--border);
    }

    .text {
        opacity: 0.9;
        font-size: 0.92em;
        /* padding: 0 10px; */
    }
</style>
