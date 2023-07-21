// Copyright 2023 Datav.io Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { Box, useToast } from "@chakra-ui/react"
import PageContainer from "layouts/PageContainer"
import { useCallback, useEffect, useRef, useState } from "react"
import { Dashboard, Panel } from "types/dashboard"
import { requestApi } from "utils/axios/request"
import DashboardHeader from "src/views/dashboard/DashboardHeader"
import DashboardGrid from "src/views/dashboard/grid/DashboardGrid"
import { clone, cloneDeep, concat, defaults, defaultsDeep, find, findIndex } from "lodash"
import { Variable } from "types/variable"
import { setVariableSelected } from "src/views/variables/Variables"
import { prevQueries, prevQueryData } from "src/views/dashboard/grid/PanelGrid"
import { unstable_batchedUpdates } from "react-dom"
import useBus, { dispatch } from 'use-bus'
import { SetDashboardEvent, TimeChangedEvent, UpdatePanelEvent, VariableChangedEvent } from "src/data/bus-events"
import React from "react";
import { useImmer } from "use-immer"
import { setAutoFreeze } from "immer";
import { initPanelPlugins } from "src/data/panel/initPlugins"
import { initPanelStyles } from "src/data/panel/initStyles"
import Border from "components/largescreen/components/Border"
import useFullscreen from "hooks/useFullscreen"
import { initDashboard } from "src/data/dashboard"
import { initPanel } from "src/data/panel/initPanel"




setAutoFreeze(false)
// All of the paths that is not defined in pages directory will redirect to this page,
// generally these pages are defined in:
// 1. team's side menu, asscessed by a specific url path
// 2. dashboard page, accessed by a dashboard id
export let variables: Variable[] = []
const DashboardWrapper = ({ dashboardId }) => {
    const [dashboard, setDashboard] = useImmer<Dashboard>(null)
    // const [gVariables, setGVariables] = useState<Variable[]>([])
    const fullscreen = useFullscreen()

    useEffect(() => {
        if (!dashboard) {
            load()
        }
        return () => {
            for (const k in prevQueries) {
                delete prevQueries[k]
                delete prevQueryData[k]
            }
        }
    }, [])

    useBus(
        (e) => { return e.type == SetDashboardEvent },
        (e) => {
            const dash = initDash(e.data)
            setDashboard(clone(dash))
        }
    )

    useBus(
        (e) => { return e.type == UpdatePanelEvent },
        (e) => {
            setDashboard((dash: Dashboard) => {
                const i = findIndex(dash.data.panels, p => p.id == e.data.id)
                if (i >= 0) {
                    dash.data.panels[i] = e.data
                }
            })
        }
    )

    useEffect(() => {
        if (dashboard) {
            setTimeout(() => {
                if (dashboard.data.styles?.bgEnabled && dashboard?.data.styles?.bg) {
                    let bodyStyle = document.body.style
                    bodyStyle.background = dashboard?.data.styles?.bg
                    bodyStyle.backgroundSize = "cover"
                }
            }, 1)
            // 
        }

        return () => {
            let bodyStyle = document.body.style
            bodyStyle.background = null
        }
    }, [dashboard])

    const load = async () => {
        const res = await requestApi.get(`/dashboard/byId/${dashboardId}`)
        const res0 = await requestApi.get(`/variable/all`)
        const dash = initDash(res.data)
        unstable_batchedUpdates(() => {
            setDashboard(cloneDeep(dash))
            setCombinedVariables(res.data, res0.data)
        })
    }

    const initDash = (dash) => {
        dash.data.panels.forEach((panel: Panel) => {
            // console.log("33333 before",cloneDeep(panel.plugins))
            panel = defaultsDeep(panel, initPanel())
            panel.plugins[panel.type] = defaultsDeep(panel.plugins[panel.type], initPanelPlugins()[panel.type])
            panel.styles = defaultsDeep(panel.styles, initPanelStyles)
            // console.log("33333 after",cloneDeep(panel.plugins[panel.type]),cloneDeep(panel.overrides))
        })

        const d1 = defaultsDeep(dash, initDashboard)
        return d1
    }

    // combine variables which defined separately in dashboard and global
    const setCombinedVariables = async (dash, gvars) => {
        const combined = concat(cloneDeep(dash.data.variables) ?? [], gvars)
        for (const v of combined) {
            v.values = []
            // get the selected value for each variable from localStorage
        }
        setVariableSelected(combined)
        variables = combined

        dispatch(VariableChangedEvent)

    }






    const onDashbardChange = useCallback(f => {
        setDashboard(f)
    }, [])


    // const visibleVars = variables.filter(v => {
    //     return !v.id.toString().startsWith("d-") && !find(dashboard?.data?.hidingVars?.split(','),v1 => v1 == v.name)
    // })




    // (visibleVars?.length > 0 ? "67px" : "38px")
    return (
        <>
            <PageContainer bg={dashboard?.data.styles.bgEnabled ? dashboard?.data.styles?.bg : null}>
                {dashboard ? <DashboardContainer dashboard={dashboard} onDashbardChange={onDashbardChange} fullscreen={fullscreen}/> :<></>}
            </PageContainer>

        </>
    )
}

export default DashboardWrapper

const DashboardContainer = ({ dashboard, onDashbardChange, fullscreen,sideWidth=null }) => {
    const headerHeight = fullscreen ? '0px' : "70px"
    return (
        <Box px="3" width="100%" height="100%" minHeight="100vh" position="relative">
            {/* <Decoration decoration={dashboard.data.styles.decoration}/> */}
            <DashboardHeader dashboard={dashboard} onChange={onDashbardChange} sideWidth={sideWidth} />
            <Box 
                // key={dashboard.id + fullscreen} 
                id="dashboard-wrapper" 
                mt={headerHeight} 
                py="2" 
                position="relative"
            >
                <DashboardBorder border={dashboard.data.styles.border} />
                {dashboard.data.panels?.length > 0 && <DashboardGrid dashboard={dashboard} onChange={onDashbardChange} />}
            </Box>
        </Box>)
}

const DashboardBorder = ({ border }) => {
    const [height, setHeight] = useState(0)
    const ref = useRef(null)
    useEffect(() => {
        ref.current = setInterval(() => {
            const ele = document.getElementById("dashboard-grid")
            const h = ele?.offsetHeight + 12
            setHeight(h)
        }, 500)
        return () => {
            clearInterval(ref.current)
        }
    }, [])


    return (
        <>
            {height > 0 && <Box key={height} position="absolute" width={'100%'} height={height} id="dashboard-border" top="5px"><Border width="100%" height="100%" border={border}><Box height="100%" width="100%"></Box></Border></Box>}
        </>
    )
}



