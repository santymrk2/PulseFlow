<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeProject, projects, projectView, quickSearchActive, showRecentlyUsedProjects, shows, special, version } from "../../stores"
    import { translateText } from "../../utils/language"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Link from "../../lib/components/ui/link/link.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import Center from "../system/Center.svelte"
    import { getVOTD } from "./votd"

    function createProject() {
        // if opened project is empty go to project list (to reduce confusion)
        if ($projects[$activeProject || ""]?.shows?.length === 0) {
            activeProject.set(null)
            projectView.set(true)
        }

        history({ id: "UPDATE", location: { page: "show", id: "project" } })

        showRecentlyUsedProjects.set(false)
    }

    let links: string[] = []
    function extractLinksAndCleanText(text: string) {
        links = []

        // extract and remove links from <a> tags
        const textWithoutATags = text.replace(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>.*?<\/a>/gi, (_match, url) => {
            links.push(url)
            return ""
        })
        // extract and remove raw links from plain text
        const finalText = textWithoutATags.replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
            links.push(url)
            return ""
        })

        return finalText.replaceAll("\n", "<br>").replace(/\s+/g, " ").trim()
    }

    let votd: string = ""
    onMount(async () => {
        if ($special.splashText) return
        votd = await getVOTD()
    })
</script>

<Center class="context #splash">
    <div class="brand">
        <img class="brand-logo" src="./logo-pulseflow.png" alt="" draggable={false} />
        <span class="brand-name">PulseFlow</span>
    </div>
    <p style="opacity: 0.7;">v{$version}</p>
    {#if $special.splashText}
        <p style="padding-top: 30px">
            {@html extractLinksAndCleanText($special.splashText)}
            <span class="links" style="display: flex;flex-direction: column;align-items: center;">
                {#each links as link}
                    <Link url={link}>
                        {link.replace(/^(https?:\/\/)/, "")}
                        <Icon id="launch" white />
                    </Link>
                {/each}
            </span>
        </p>
    {:else if Object.keys($shows).length < 20}
        <!-- shows up for new users (can be found in "About" menu) -->
        <p style="padding-top: 30px">
            <Link url="https://freeshow.app/docs">
                <T id="main.docs" />
                <Icon id="launch" white />
            </Link>
        </p>
    {:else if votd}
        <p class="votd" style="padding-top: 30px" data-title="Verse of the Day [votd.org]">
            <Link url="https://votd.org/">
                {votd}
            </Link>
        </p>
    {/if}

    <span style="padding-top: 30px" class="buttons">
        <Button variant="secondary" class="w-full justify-start" title={translateText("main.quick_search")} onclick={() => quickSearchActive.set(true)}>
            <Icon id="search" size={1} />
            <T id="main.quick_search" />
        </Button>
        <Button variant="secondary" class="w-full justify-start" title={translateText("tooltip.project")} onclick={createProject}>
            <Icon id="project" size={1} />
            <T id="new.project" />
        </Button>
        <Button
            variant="secondary"
            class="w-full justify-start"
            title={translateText("tooltip.show")}
            onclick={(e) => {
                if (e.ctrlKey) {
                    history({ id: "UPDATE", newData: { remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
                } else activePopup.set("show")
            }}
        >
            <Icon id="add" size={1} />
            <T id="new.show" />
        </Button>
    </span>
</Center>

<style>
    /* F12.9: logo de 48 px + nombre en --text, sin el título azul de texto */
    .brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
    }
    .brand-logo {
        width: 48px;
        height: 48px;
    }
    .brand-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
    }

    p {
        overflow: initial;
    }

    .buttons {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .buttons :global(button) {
        justify-content: start;
        padding: 8px 12px;
    }

    .votd {
        padding: 0 10px;
        max-width: 580px;
        white-space: normal;
        text-align: left;
        font-style: italic;
        font-size: 0.9em;
    }
    .votd :global(a) {
        text-decoration: none;
    }

    @media screen and (max-height: 500px) {
        .brand-logo {
            width: 40px;
            height: 40px;
        }
    }
</style>
