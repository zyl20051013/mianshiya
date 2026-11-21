"use client";
import { Avatar, Card, Col, Row, Tag } from "antd";
import { useSelector } from "react-redux";
import { RootState } from "@/stores";
import Title from "antd/es/typography/Title";
import Paragraph from "antd/es/typography/Paragraph";
import { useState } from "react";
import "./index.css";
import CalendarChart from "@/components/CalendarChart";

export default function UserCenterPage() {
    const loginUser = useSelector((state: RootState) => state.loginUser);
    const [activeTabKey, setActiveTabKey] = useState<string>("record");

    return (

        <div id="userCenterPage" className="max-width-content">
            <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                    <Card style={{ textAlign: "center" }}>
                        <Avatar src={loginUser.userAvatar} size={72} />
                        <div style={{ marginBottom: 16 }} />
                        <Card.Meta
                            title={
                                <Title level={4} style={{ marginBottom: 0 }}>
                                    {loginUser.userName}
                                </Title>
                            }
                            description={<Paragraph type="secondary">{loginUser.userProfile}</Paragraph>}
                        />
                        <Tag color={loginUser.userRole === "admin" ? "gold" : "default"}>
                            {loginUser.userRole}
                        </Tag>
                    </Card>
                </Col>

                <Col xs={24} md={18}>
                    <Card
                        tabList={[
                            { key: "record", label: "刷题记录" },
                            { key: "about", label: "关于" },
                        ]}
                        activeTabKey={activeTabKey}
                        onTabChange={(key: string) => setActiveTabKey(key)}
                    >
                        {activeTabKey === "record" && <CalendarChart />}
                        {activeTabKey === "about" && (
                            <Paragraph type="secondary">
                                我的 id：{loginUser.id}　角色：{loginUser.userRole}
                            </Paragraph>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}