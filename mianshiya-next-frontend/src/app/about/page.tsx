import Title from "antd/es/typography/Title";

export default function AboutPage() {
    return (
        <div className="max-width-content" style={{ padding: "20px" }}>
            <Title level={3}>关于本站</Title>
            <p>这是一个用于学习的面试刷题平台。</p>
        </div>
    );
}